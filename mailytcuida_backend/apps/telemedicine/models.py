"""
Telemedicine — Phase 1: external link (Zoom/Meet).

Architecture decision: video infrastructure is external in Phase 1.
The doctor creates a Zoom/Meet session outside the platform and pastes
the link. MailyT-Cuida manages the pre-session checklist, waiting room
status, and post-session clinical note.

Future Phase 2 would integrate a WebRTC provider (Daily.co, Twilio Video,
etc.) via a webhook that auto-creates the room.

Models:
  VideoSession    — one per Appointment of type VIDEO
  SessionCheckin  — patient signals they are ready (waiting room)
  SessionNote     — post-session clinical summary (extends AppointmentNote)
"""
import uuid
from django.db import models


class SessionStatus(models.TextChoices):
    SCHEDULED   = 'SCHEDULED',   'Agendada'
    WAITING     = 'WAITING',     'Paciente en sala de espera'
    IN_PROGRESS = 'IN_PROGRESS', 'En curso'
    COMPLETED   = 'COMPLETED',   'Finalizada'
    CANCELLED   = 'CANCELLED',   'Cancelada'
    NO_SHOW     = 'NO_SHOW',     'Paciente no se presentó'


class VideoProvider(models.TextChoices):
    ZOOM        = 'ZOOM',     'Zoom'
    GOOGLE_MEET = 'MEET',     'Google Meet'
    TEAMS       = 'TEAMS',    'Microsoft Teams'
    WHEREBY     = 'WHEREBY',  'Whereby'
    OTHER       = 'OTHER',    'Otro'


class VideoSession(models.Model):
    """
    Extends an Appointment (VIDEO type) with telemedicine-specific fields.
    OneToOne with Appointment — created automatically when doctor sets
    appointment_type = VIDEO.
    """
    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    appointment  = models.OneToOneField(
        'appointments.Appointment',
        on_delete=models.CASCADE,
        related_name='video_session',
    )
    provider     = models.CharField(
        max_length=10, choices=VideoProvider.choices, default=VideoProvider.ZOOM
    )
    # External meeting URL pasted by the doctor
    meeting_url  = models.URLField(max_length=1024, blank=True)
    # Provider-specific meeting ID / password (informational)
    meeting_id   = models.CharField(max_length=128, blank=True)
    meeting_password = models.CharField(max_length=64, blank=True)

    status       = models.CharField(
        max_length=12, choices=SessionStatus.choices, default=SessionStatus.SCHEDULED
    )

    # Timing
    started_at   = models.DateTimeField(null=True, blank=True)
    ended_at     = models.DateTimeField(null=True, blank=True)

    # Duration in minutes (computed on end)
    duration_min = models.PositiveSmallIntegerField(null=True, blank=True)

    # Pre-session checklist (patient confirms vitals, consent, tech check)
    checklist_completed = models.BooleanField(default=False)

    # Technical quality rating (1–5) filled by patient after session
    tech_quality = models.PositiveSmallIntegerField(null=True, blank=True)
    # Overall session rating by patient
    patient_rating = models.PositiveSmallIntegerField(null=True, blank=True)
    patient_feedback = models.TextField(blank=True)

    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return (f'VideoSession {self.appointment.patient} ↔ '
                f'{self.appointment.doctor} [{self.get_status_display()}]')


class SessionCheckin(models.Model):
    """
    Patient checks in to the waiting room.
    Doctor sees a real-time indicator that the patient is ready.
    """
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session     = models.OneToOneField(
        VideoSession, on_delete=models.CASCADE, related_name='checkin'
    )
    checked_in_at = models.DateTimeField(auto_now_add=True)
    # Patient's reported vitals just before the session (optional quick capture)
    pre_vitals  = models.JSONField(default=dict, blank=True,
                                   help_text='{"heart_rate": 72, "blood_pressure": "120/80"}')
    device_info = models.CharField(max_length=255, blank=True,
                                   help_text='Browser / OS for tech support')

    def __str__(self):
        return f'Checkin {self.session} @ {self.checked_in_at:%H:%M}'


class SessionNote(models.Model):
    """
    Post-session clinical note written by the doctor.
    Separate from AppointmentNote to allow structured telemedicine-specific fields.
    """
    id             = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    session        = models.OneToOneField(
        VideoSession, on_delete=models.CASCADE, related_name='note'
    )
    subjective     = models.TextField(blank=True, help_text='Motivo de consulta / síntomas')
    objective      = models.TextField(blank=True, help_text='Hallazgos clínicos observados')
    assessment     = models.TextField(blank=True, help_text='Diagnóstico / impresión clínica')
    plan           = models.TextField(blank=True, help_text='Plan de tratamiento')
    follow_up_days = models.PositiveSmallIntegerField(null=True, blank=True,
                                                       help_text='Días hasta próxima cita')
    prescriptions_issued = models.BooleanField(default=False)
    referrals_made = models.BooleanField(default=False)
    created_at     = models.DateTimeField(auto_now_add=True)
    updated_at     = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'Note for {self.session}'
