"""
Telemedicine API.

Doctor:
  POST  /api/v1/telemedicine/sessions/             — create session for a VIDEO appointment
  GET   /api/v1/telemedicine/sessions/             — list my sessions
  GET   /api/v1/telemedicine/sessions/<id>/        — detail
  PATCH /api/v1/telemedicine/sessions/<id>/link/   — update meeting URL/provider
  PATCH /api/v1/telemedicine/sessions/<id>/status/ — change session status
  POST  /api/v1/telemedicine/sessions/<id>/note/   — write post-session note
  GET   /api/v1/telemedicine/sessions/<id>/checkin/ — see patient checkin status

Patient:
  GET  /api/v1/telemedicine/sessions/mine/          — my upcoming/past sessions
  POST /api/v1/telemedicine/sessions/<id>/checkin/  — check in to waiting room
  POST /api/v1/telemedicine/sessions/<id>/feedback/ — post-session feedback
"""
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.accounts.models import DoctorProfile, PatientProfile, DoctorPatient
from .models import VideoSession, SessionCheckin, SessionNote, SessionStatus
from .serializers import (
    VideoSessionSerializer, VideoSessionCreateSerializer,
    SessionStatusUpdateSerializer, SessionNoteSerializer,
    SessionCheckinSerializer, PatientFeedbackSerializer,
)


def _get_doctor(request):
    return get_object_or_404(DoctorProfile, user=request.user)


def _get_patient(request):
    return get_object_or_404(PatientProfile, user=request.user)


# ── Doctor ─────────────────────────────────────────────────────────────────────

class SessionListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        doctor   = _get_doctor(request)
        sessions = VideoSession.objects.filter(
            appointment__doctor=doctor
        ).select_related('appointment__patient', 'appointment__doctor')
        return Response(VideoSessionSerializer(sessions, many=True).data)

    def post(self, request):
        doctor = _get_doctor(request)
        ser    = VideoSessionCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        appt = ser.validated_data['appointment']
        if appt.doctor != doctor:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Esta cita no te pertenece.')

        session = ser.save()

        # Notify patient
        try:
            from apps.notifications.service import notify
            notify(
                user    = appt.patient.user,
                code    = 'VIDEO_SESSION_READY',
                context = {
                    'doctor_name': f'Dr. {doctor.first_name} {doctor.last_name}',
                    'meeting_url': session.meeting_url,
                },
                channel = 'PUSH',
            )
        except Exception:
            pass

        return Response(VideoSessionSerializer(session).data, status=status.HTTP_201_CREATED)


class SessionDetailView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class   = VideoSessionSerializer

    def get_object(self):
        session = get_object_or_404(VideoSession, pk=self.kwargs['pk'])
        user    = self.request.user
        role    = getattr(user, 'role', '')
        if role == 'DOCTOR' and session.appointment.doctor.user != user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied()
        if role == 'PATIENT' and session.appointment.patient.user != user:
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied()
        return session


class SessionLinkUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        doctor  = _get_doctor(request)
        session = get_object_or_404(VideoSession, pk=pk, appointment__doctor=doctor)
        for field in ('meeting_url', 'meeting_id', 'meeting_password', 'provider'):
            if field in request.data:
                setattr(session, field, request.data[field])
        session.save()
        return Response(VideoSessionSerializer(session).data)


class SessionStatusUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        doctor  = _get_doctor(request)
        session = get_object_or_404(VideoSession, pk=pk, appointment__doctor=doctor)
        ser     = SessionStatusUpdateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        new_status = ser.validated_data['status']
        now        = timezone.now()

        if new_status == 'IN_PROGRESS' and not session.started_at:
            session.started_at = now
        if new_status == 'COMPLETED':
            session.ended_at = now
            if session.started_at:
                delta = now - session.started_at
                session.duration_min = int(delta.total_seconds() / 60)

        session.status = new_status
        session.save()
        return Response(VideoSessionSerializer(session).data)


class SessionNoteView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        doctor  = _get_doctor(request)
        session = get_object_or_404(
            VideoSession, pk=pk, appointment__doctor=doctor,
            status=SessionStatus.COMPLETED,
        )
        if hasattr(session, 'note'):
            ser = SessionNoteSerializer(session.note, data=request.data, partial=True)
        else:
            ser = SessionNoteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ser.save(session=session)
        return Response(ser.data, status=status.HTTP_201_CREATED)


# ── Patient ────────────────────────────────────────────────────────────────────

class PatientSessionListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class   = VideoSessionSerializer

    def get_queryset(self):
        patient = _get_patient(self.request)
        return VideoSession.objects.filter(
            appointment__patient=patient
        ).select_related('appointment__doctor', 'appointment__patient')


class PatientCheckinView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        """Doctor polls this to see if patient checked in."""
        session = get_object_or_404(VideoSession, pk=pk)
        if not hasattr(session, 'checkin'):
            return Response({'checked_in': False})
        return Response({
            'checked_in':     True,
            'checked_in_at':  session.checkin.checked_in_at,
            'pre_vitals':     session.checkin.pre_vitals,
        })

    def post(self, request, pk):
        """Patient checks in to the waiting room."""
        patient = _get_patient(request)
        session = get_object_or_404(
            VideoSession, pk=pk, appointment__patient=patient
        )
        if hasattr(session, 'checkin'):
            return Response({'detail': 'Ya estás en sala de espera.'}, status=status.HTTP_200_OK)

        ser = SessionCheckinSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ser.save(session=session)

        # Update session status to WAITING
        if session.status == SessionStatus.SCHEDULED:
            session.status = SessionStatus.WAITING
            session.save(update_fields=['status'])

        # Notify doctor
        try:
            from apps.notifications.service import notify
            notify(
                user    = session.appointment.doctor.user,
                code    = 'PATIENT_WAITING',
                context = {
                    'patient_name': f'{patient.first_name} {patient.last_name}',
                },
                channel = 'PUSH',
            )
        except Exception:
            pass

        return Response(ser.data, status=status.HTTP_201_CREATED)


class PatientFeedbackView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        patient = _get_patient(request)
        session = get_object_or_404(
            VideoSession, pk=pk,
            appointment__patient=patient,
            status=SessionStatus.COMPLETED,
        )
        ser = PatientFeedbackSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        session.tech_quality     = ser.validated_data['tech_quality']
        session.patient_rating   = ser.validated_data['patient_rating']
        session.patient_feedback = ser.validated_data.get('patient_feedback', '')
        session.save(update_fields=['tech_quality', 'patient_rating', 'patient_feedback'])
        return Response(VideoSessionSerializer(session).data)
