from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination

from core.permissions import IsPatient, IsDoctor, IsDoctorOfPatient
from .models import Appointment, AppointmentNote
from .serializers import (
    AppointmentSerializer, AppointmentCreateSerializer,
    AppointmentNoteSerializer,
    CancelSerializer, RescheduleSerializer, ConfirmSerializer,
)


class ApptPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


def _apply_filters(qs, params):
    appt_status = params.get('status')
    from_date   = params.get('from')
    to_date     = params.get('to')
    if appt_status:
        qs = qs.filter(status=appt_status)
    if from_date:
        qs = qs.filter(scheduled_at__date__gte=from_date)
    if to_date:
        qs = qs.filter(scheduled_at__date__lte=to_date)
    return qs


# ── Patient views ─────────────────────────────────────────────────────────────

class PatientAppointmentListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsPatient]
    pagination_class = ApptPagination

    def get_queryset(self):
        qs = Appointment.objects.filter(
            patient=self.request.user.patient_profile
        ).select_related('doctor', 'patient')
        return _apply_filters(qs, self.request.query_params)

    def get_serializer_class(self):
        return AppointmentCreateSerializer if self.request.method == 'POST' else AppointmentSerializer

    def create(self, request, *args, **kwargs):
        serializer = AppointmentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        appt = serializer.save(patient=request.user.patient_profile)
        _schedule_reminders(appt)
        return Response(AppointmentSerializer(appt).data, status=status.HTTP_201_CREATED)


class PatientAppointmentDetailView(generics.RetrieveAPIView):
    permission_classes = [IsPatient]
    serializer_class = AppointmentSerializer

    def get_queryset(self):
        return Appointment.objects.filter(
            patient=self.request.user.patient_profile
        ).select_related('doctor', 'patient', 'clinical_note')


class PatientCancelView(APIView):
    permission_classes = [IsPatient]

    def post(self, request, pk):
        appt = get_object_or_404(
            Appointment, pk=pk, patient=request.user.patient_profile
        )
        if appt.status not in (Appointment.Status.PENDING, Appointment.Status.CONFIRMED):
            return Response(
                {'detail': 'Solo se pueden cancelar citas PENDING o CONFIRMED.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = CancelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        appt.status              = Appointment.Status.CANCELLED
        appt.cancelled_by        = request.user
        appt.cancellation_reason = serializer.validated_data.get('reason', '')
        appt.save()
        return Response(AppointmentSerializer(appt).data)


# ── Doctor views ──────────────────────────────────────────────────────────────

class DoctorAppointmentListView(generics.ListAPIView):
    permission_classes = [IsDoctor]
    serializer_class = AppointmentSerializer
    pagination_class = ApptPagination

    def get_queryset(self):
        qs = Appointment.objects.filter(
            doctor=self.request.user.doctor_profile
        ).select_related('doctor', 'patient')
        return _apply_filters(qs, self.request.query_params)


class DoctorConfirmView(APIView):
    permission_classes = [IsDoctor]

    def post(self, request, pk):
        appt = get_object_or_404(Appointment, pk=pk, doctor=request.user.doctor_profile)
        if appt.status != Appointment.Status.PENDING:
            return Response(
                {'detail': 'Solo se pueden confirmar citas PENDING.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = ConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data
        appt.status = Appointment.Status.CONFIRMED
        if d.get('video_link'):
            appt.video_link = d['video_link']
        if d.get('location'):
            appt.location = d['location']
        if d.get('notes'):
            appt.notes = d['notes']
        appt.save()
        return Response(AppointmentSerializer(appt).data)


class DoctorCompleteView(APIView):
    permission_classes = [IsDoctor]

    def post(self, request, pk):
        appt = get_object_or_404(Appointment, pk=pk, doctor=request.user.doctor_profile)
        if appt.status not in (Appointment.Status.CONFIRMED, Appointment.Status.PENDING):
            return Response(
                {'detail': 'Solo se pueden completar citas CONFIRMED o PENDING.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        appt.status = Appointment.Status.COMPLETED
        appt.save()
        return Response(AppointmentSerializer(appt).data)


class DoctorRescheduleView(APIView):
    permission_classes = [IsDoctor]

    def patch(self, request, pk):
        appt = get_object_or_404(Appointment, pk=pk, doctor=request.user.doctor_profile)
        if appt.status not in (Appointment.Status.PENDING, Appointment.Status.CONFIRMED):
            return Response(
                {'detail': 'Solo se pueden reagendar citas PENDING o CONFIRMED.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = RescheduleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        # Mark current as rescheduled
        appt.status = Appointment.Status.RESCHEDULED
        appt.save()

        # Create new appointment
        new_appt = Appointment.objects.create(
            patient=appt.patient,
            doctor=appt.doctor,
            appointment_type=appt.appointment_type,
            status=Appointment.Status.CONFIRMED,
            scheduled_at=d['scheduled_at'],
            duration_minutes=appt.duration_minutes,
            reason=appt.reason,
            video_link=d.get('video_link', appt.video_link),
            location=d.get('location', appt.location),
            notes=d.get('notes', ''),
        )
        _schedule_reminders(new_appt)
        return Response(AppointmentSerializer(new_appt).data, status=status.HTTP_201_CREATED)


class AppointmentNoteView(APIView):
    permission_classes = [IsDoctor]

    def get(self, request, pk):
        appt = get_object_or_404(Appointment, pk=pk, doctor=request.user.doctor_profile)
        try:
            note = appt.clinical_note
        except AppointmentNote.DoesNotExist:
            return Response({})
        return Response(AppointmentNoteSerializer(note).data)

    def post(self, request, pk):
        appt = get_object_or_404(Appointment, pk=pk, doctor=request.user.doctor_profile)
        if appt.status != Appointment.Status.COMPLETED:
            return Response(
                {'detail': 'Solo se pueden agregar notas a citas COMPLETED.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            note = appt.clinical_note
            serializer = AppointmentNoteSerializer(note, data=request.data, partial=True)
        except AppointmentNote.DoesNotExist:
            serializer = AppointmentNoteSerializer(data=request.data)

        serializer.is_valid(raise_exception=True)
        note = serializer.save(appointment=appt)
        return Response(AppointmentNoteSerializer(note).data, status=status.HTTP_201_CREATED)


# ── helpers ───────────────────────────────────────────────────────────────────

def _schedule_reminders(appt: Appointment):
    from .tasks import send_appointment_reminder
    from datetime import timedelta

    now = timezone.now()
    remind_24h = appt.scheduled_at - timedelta(hours=24)
    remind_1h  = appt.scheduled_at - timedelta(hours=1)

    if remind_24h > now:
        send_appointment_reminder.apply_async(
            args=[str(appt.pk), 24], eta=remind_24h
        )
    if remind_1h > now:
        send_appointment_reminder.apply_async(
            args=[str(appt.pk), 1], eta=remind_1h
        )
