"""
Wellness views.

ADMIN / DOCTOR → CRUD programs, activities, enroll patients, read all data.
PATIENT        → read programs, manage own mood/sleep entries,
                 mark activities complete, read own check-ins.
"""
from django.utils import timezone
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import PatientProfile
from apps.audit.logger import ResourceType, audit
from apps.notifications.service import notify

from .models import (
    ActivityCompletion,
    DailyCheckin,
    MoodEntry,
    ProgramEnrollment,
    SleepEntry,
    WellnessActivity,
    WellnessProgram,
)
from .serializers import (
    ActivityCompletionSerializer,
    DailyCheckinSerializer,
    MoodEntrySerializer,
    ProgramEnrollmentCreateSerializer,
    ProgramEnrollmentSerializer,
    SleepEntrySerializer,
    WellnessActivitySerializer,
    WellnessProgramSerializer,
    WellnessProgramWriteSerializer,
)
from .services import complete_activity, upsert_daily_checkin


def _is_staff(user):
    return getattr(user, 'role', '') in ('ADMIN', 'DOCTOR')


def _get_patient(user):
    try:
        return PatientProfile.objects.get(user=user)
    except PatientProfile.DoesNotExist:
        return None


# ── Programs ──────────────────────────────────────────────────────────────────

class WellnessProgramListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = WellnessProgram.objects.prefetch_related('activities')
        if not _is_staff(self.request.user):
            qs = qs.filter(is_active=True)
        return qs

    def get_serializer_class(self):
        return WellnessProgramWriteSerializer if self.request.method == 'POST' else WellnessProgramSerializer

    def perform_create(self, serializer):
        if not _is_staff(self.request.user):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Solo el staff puede crear programas.')
        program = serializer.save(created_by=self.request.user)
        audit(request=self.request, action='CREATE', resource_type=ResourceType.OTHER,
              resource_id=str(program.id), note=f'title={program.title}')


class WellnessProgramDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    queryset = WellnessProgram.objects.prefetch_related('activities')

    def get_serializer_class(self):
        return WellnessProgramWriteSerializer if self.request.method in ('PUT', 'PATCH') else WellnessProgramSerializer

    def perform_update(self, serializer):
        if not _is_staff(self.request.user):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied()
        serializer.save()

    def perform_destroy(self, instance):
        if not _is_staff(self.request.user):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied()
        instance.is_active = False
        instance.save(update_fields=['is_active'])


# ── Activities ────────────────────────────────────────────────────────────────

class WellnessActivityListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = WellnessActivitySerializer

    def get_queryset(self):
        return WellnessActivity.objects.filter(program_id=self.kwargs['program_pk'])

    def perform_create(self, serializer):
        if not _is_staff(self.request.user):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied()
        from django.shortcuts import get_object_or_404
        program = get_object_or_404(WellnessProgram, pk=self.kwargs['program_pk'])
        serializer.save(program=program)


class WellnessActivityDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = WellnessActivitySerializer

    def get_queryset(self):
        return WellnessActivity.objects.filter(program_id=self.kwargs['program_pk'])

    def perform_update(self, serializer):
        if not _is_staff(self.request.user):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied()
        serializer.save()

    def perform_destroy(self, instance):
        if not _is_staff(self.request.user):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied()
        instance.delete()


# ── Enrollments ───────────────────────────────────────────────────────────────

class EnrollmentListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if _is_staff(user):
            return ProgramEnrollment.objects.select_related('program', 'patient__user').prefetch_related('completions')
        patient = _get_patient(user)
        if not patient:
            return ProgramEnrollment.objects.none()
        return ProgramEnrollment.objects.filter(patient=patient).select_related('program').prefetch_related('completions')

    def get_serializer_class(self):
        return ProgramEnrollmentCreateSerializer if self.request.method == 'POST' else ProgramEnrollmentSerializer

    def perform_create(self, serializer):
        if not _is_staff(self.request.user):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Solo el staff puede inscribir pacientes.')
        enrollment = serializer.save(enrolled_by=self.request.user)
        notify(
            user=enrollment.patient.user,
            code='WELLNESS_PROGRAM_ENROLLED',
            channel='IN_APP',
            extra_data={'program_title': enrollment.program.title},
        )
        audit(request=self.request, action='CREATE', resource_type=ResourceType.OTHER,
              resource_id=str(enrollment.id),
              note=f'program={enrollment.program.title} patient={enrollment.patient_id}')


class EnrollmentDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = ProgramEnrollmentSerializer

    def get_queryset(self):
        user = self.request.user
        if _is_staff(user):
            return ProgramEnrollment.objects.prefetch_related('completions')
        patient = _get_patient(user)
        return ProgramEnrollment.objects.filter(patient=patient).prefetch_related('completions') if patient else ProgramEnrollment.objects.none()

    def perform_update(self, serializer):
        if not _is_staff(self.request.user):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied()
        serializer.save()


# ── Mark activity complete ────────────────────────────────────────────────────

class CompleteActivityView(APIView):
    """
    POST /api/v1/wellness/enrollments/<pk>/complete-activity/
    Body: { "activity": "<uuid>", "note": "..." }
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        from django.shortcuts import get_object_or_404
        user = request.user
        if _is_staff(user):
            enrollment = get_object_or_404(ProgramEnrollment, pk=pk)
        else:
            patient = _get_patient(user)
            if not patient:
                return Response({'detail': 'No patient profile.'}, status=status.HTTP_403_FORBIDDEN)
            enrollment = get_object_or_404(ProgramEnrollment, pk=pk, patient=patient)

        activity_id = request.data.get('activity')
        if not activity_id:
            return Response({'detail': 'activity is required.'}, status=status.HTTP_400_BAD_REQUEST)

        activity = get_object_or_404(WellnessActivity, pk=activity_id, program=enrollment.program)
        note = request.data.get('note', '')

        completion = complete_activity(enrollment, activity, note=note)
        return Response(ActivityCompletionSerializer(completion).data, status=status.HTTP_201_CREATED)


# ── Mood ──────────────────────────────────────────────────────────────────────

class MoodEntryListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = MoodEntrySerializer

    def get_queryset(self):
        user = self.request.user
        if _is_staff(user):
            patient_id = self.request.query_params.get('patient')
            qs = MoodEntry.objects.all()
            return qs.filter(patient_id=patient_id) if patient_id else qs
        patient = _get_patient(user)
        return MoodEntry.objects.filter(patient=patient) if patient else MoodEntry.objects.none()

    def perform_create(self, serializer):
        patient = _get_patient(self.request.user)
        if not patient:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied()
        entry = serializer.save(patient=patient)
        upsert_daily_checkin(patient, entry_date=entry.logged_at.date())


class MoodEntryDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = MoodEntrySerializer

    def get_queryset(self):
        user = self.request.user
        if _is_staff(user):
            return MoodEntry.objects.all()
        patient = _get_patient(user)
        return MoodEntry.objects.filter(patient=patient) if patient else MoodEntry.objects.none()


# ── Sleep ─────────────────────────────────────────────────────────────────────

class SleepEntryListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = SleepEntrySerializer

    def get_queryset(self):
        user = self.request.user
        if _is_staff(user):
            patient_id = self.request.query_params.get('patient')
            qs = SleepEntry.objects.all()
            return qs.filter(patient_id=patient_id) if patient_id else qs
        patient = _get_patient(user)
        return SleepEntry.objects.filter(patient=patient) if patient else SleepEntry.objects.none()

    def perform_create(self, serializer):
        patient = _get_patient(self.request.user)
        if not patient:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied()
        entry = serializer.save(patient=patient)
        upsert_daily_checkin(patient, entry_date=entry.sleep_date)


class SleepEntryDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = SleepEntrySerializer

    def get_queryset(self):
        user = self.request.user
        if _is_staff(user):
            return SleepEntry.objects.all()
        patient = _get_patient(user)
        return SleepEntry.objects.filter(patient=patient) if patient else SleepEntry.objects.none()


# ── Daily Check-in ────────────────────────────────────────────────────────────

class DailyCheckinListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = DailyCheckinSerializer

    def get_queryset(self):
        user = self.request.user
        if _is_staff(user):
            patient_id = self.request.query_params.get('patient')
            qs = DailyCheckin.objects.all()
            return qs.filter(patient_id=patient_id) if patient_id else qs
        patient = _get_patient(user)
        return DailyCheckin.objects.filter(patient=patient) if patient else DailyCheckin.objects.none()


class DailyCheckinDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = DailyCheckinSerializer

    def get_queryset(self):
        user = self.request.user
        if _is_staff(user):
            return DailyCheckin.objects.all()
        patient = _get_patient(user)
        return DailyCheckin.objects.filter(patient=patient) if patient else DailyCheckin.objects.none()
