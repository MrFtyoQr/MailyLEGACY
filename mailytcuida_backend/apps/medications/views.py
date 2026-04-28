from django.utils import timezone
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination

from core.permissions import IsPatient, IsDoctor, IsDoctorOfPatient
from .models import Medication, MedicationPattern, MedicationSchedule, MealSchedule, MedicationHistory
from .serializers import (
    MedicationSerializer, MedicationWriteSerializer,
    MedicationPatternSerializer, MedicationScheduleSerializer,
    MealScheduleSerializer, MedicationHistorySerializer,
    TakeActionSerializer, SkipActionSerializer, PostponeActionSerializer,
)


class HistoryPagination(PageNumberPagination):
    page_size = 30
    page_size_query_param = 'page_size'
    max_page_size = 100


# ── Medications ──────────────────────────────────────────────────────────────

class MedicationListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsPatient]

    def get_queryset(self):
        return Medication.objects.filter(
            patient=self.request.user.patient_profile, is_active=True
        )

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return MedicationWriteSerializer
        return MedicationSerializer

    def perform_create(self, serializer):
        serializer.save(patient=self.request.user.patient_profile)


class MedicationDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsPatient]
    http_method_names = ['get', 'patch', 'delete']

    def get_queryset(self):
        return Medication.objects.filter(
            patient=self.request.user.patient_profile, is_active=True
        )

    def get_serializer_class(self):
        if self.request.method == 'PATCH':
            return MedicationWriteSerializer
        return MedicationSerializer

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=['is_active'])


# ── Patterns ─────────────────────────────────────────────────────────────────

class PatternListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsPatient]
    serializer_class = MedicationPatternSerializer

    def _get_medication(self):
        return get_object_or_404(
            Medication,
            pk=self.kwargs['medication_pk'],
            patient=self.request.user.patient_profile,
            is_active=True,
        )

    def get_queryset(self):
        return MedicationPattern.objects.filter(
            medication=self._get_medication(), is_active=True
        )

    def perform_create(self, serializer):
        serializer.save(medication=self._get_medication())


class PatternDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsPatient]
    serializer_class = MedicationPatternSerializer
    http_method_names = ['patch', 'delete']

    def get_queryset(self):
        med = get_object_or_404(
            Medication,
            pk=self.kwargs['medication_pk'],
            patient=self.request.user.patient_profile,
            is_active=True,
        )
        return MedicationPattern.objects.filter(medication=med)

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=['is_active'])


# ── Schedules ─────────────────────────────────────────────────────────────────

class ScheduleListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsPatient]
    serializer_class = MedicationScheduleSerializer

    def _get_medication(self):
        return get_object_or_404(
            Medication,
            pk=self.kwargs['medication_pk'],
            patient=self.request.user.patient_profile,
            is_active=True,
        )

    def get_queryset(self):
        return MedicationSchedule.objects.filter(
            medication=self._get_medication(), is_active=True
        )

    def perform_create(self, serializer):
        serializer.save(medication=self._get_medication())


class ScheduleDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsPatient]
    serializer_class = MedicationScheduleSerializer
    http_method_names = ['patch', 'delete']

    def get_queryset(self):
        med = get_object_or_404(
            Medication,
            pk=self.kwargs['medication_pk'],
            patient=self.request.user.patient_profile,
            is_active=True,
        )
        return MedicationSchedule.objects.filter(medication=med)

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=['is_active'])


# ── Meal Schedules ────────────────────────────────────────────────────────────

class MealScheduleListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsPatient]
    serializer_class = MealScheduleSerializer

    def get_queryset(self):
        return MealSchedule.objects.filter(
            patient=self.request.user.patient_profile, is_active=True
        )

    def perform_create(self, serializer):
        serializer.save(patient=self.request.user.patient_profile)


class MealScheduleDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsPatient]
    serializer_class = MealScheduleSerializer
    http_method_names = ['get', 'patch', 'delete']

    def get_queryset(self):
        return MealSchedule.objects.filter(
            patient=self.request.user.patient_profile
        )


# ── History ───────────────────────────────────────────────────────────────────

class HistoryListView(generics.ListAPIView):
    permission_classes = [IsPatient]
    serializer_class = MedicationHistorySerializer
    pagination_class = HistoryPagination

    def get_queryset(self):
        qs = MedicationHistory.objects.filter(patient=self.request.user.patient_profile)
        from_date = self.request.query_params.get('from')
        to_date   = self.request.query_params.get('to')
        if from_date:
            qs = qs.filter(scheduled_at__date__gte=from_date)
        if to_date:
            qs = qs.filter(scheduled_at__date__lte=to_date)
        return qs


class HistoryTodayView(generics.ListAPIView):
    permission_classes = [IsPatient]
    serializer_class = MedicationHistorySerializer

    def get_queryset(self):
        today = timezone.localdate()
        return MedicationHistory.objects.filter(
            patient=self.request.user.patient_profile,
            scheduled_at__date=today,
        )


class HistoryTakeView(APIView):
    permission_classes = [IsPatient]

    def post(self, request, pk):
        entry = get_object_or_404(
            MedicationHistory, pk=pk, patient=request.user.patient_profile
        )
        if entry.status != MedicationHistory.Status.PENDING:
            return Response(
                {'detail': 'Solo se pueden marcar entradas PENDING.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = TakeActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data
        entry.status         = MedicationHistory.Status.TAKEN
        entry.actual_taken_at = timezone.now()
        entry.dosage_taken   = d.get('dosage_taken', '')
        entry.notes          = d.get('notes', '')
        entry.side_effects   = d.get('side_effects', '')
        entry.save()
        return Response(MedicationHistorySerializer(entry).data)


class HistorySkipView(APIView):
    permission_classes = [IsPatient]

    def post(self, request, pk):
        entry = get_object_or_404(
            MedicationHistory, pk=pk, patient=request.user.patient_profile
        )
        if entry.status != MedicationHistory.Status.PENDING:
            return Response(
                {'detail': 'Solo se pueden omitir entradas PENDING.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = SkipActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        entry.status = MedicationHistory.Status.SKIPPED
        entry.notes  = serializer.validated_data.get('notes', '')
        entry.save()
        return Response(MedicationHistorySerializer(entry).data)


class HistoryPostponeView(APIView):
    permission_classes = [IsPatient]

    def post(self, request, pk):
        entry = get_object_or_404(
            MedicationHistory, pk=pk, patient=request.user.patient_profile
        )
        if entry.status != MedicationHistory.Status.PENDING:
            return Response(
                {'detail': 'Solo se pueden posponer entradas PENDING.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = PostponeActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data
        from datetime import timedelta
        entry.status       = MedicationHistory.Status.POSTPONED
        entry.scheduled_at = entry.scheduled_at + timedelta(minutes=d['minutes'])
        entry.notes        = d.get('notes', '')
        entry.save()
        return Response(MedicationHistorySerializer(entry).data)


# ── Doctor views ──────────────────────────────────────────────────────────────

class DoctorPatientMedicationsView(generics.ListAPIView):
    permission_classes = [IsDoctor, IsDoctorOfPatient]
    serializer_class = MedicationSerializer

    def get_queryset(self):
        from apps.accounts.models import PatientProfile
        patient = get_object_or_404(PatientProfile, pk=self.kwargs['patient_id'])
        self.check_object_permissions(self.request, patient)
        return Medication.objects.filter(patient=patient, is_active=True)


class DoctorPatientHistoryView(generics.ListAPIView):
    permission_classes = [IsDoctor, IsDoctorOfPatient]
    serializer_class = MedicationHistorySerializer
    pagination_class = HistoryPagination

    def get_queryset(self):
        from apps.accounts.models import PatientProfile
        patient = get_object_or_404(PatientProfile, pk=self.kwargs['patient_id'])
        self.check_object_permissions(self.request, patient)
        qs = MedicationHistory.objects.filter(patient=patient)
        from_date = self.request.query_params.get('from')
        to_date   = self.request.query_params.get('to')
        if from_date:
            qs = qs.filter(scheduled_at__date__gte=from_date)
        if to_date:
            qs = qs.filter(scheduled_at__date__lte=to_date)
        return qs
