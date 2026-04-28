import uuid
from django.db import models


class Appointment(models.Model):
    class AppointmentType(models.TextChoices):
        IN_PERSON = 'IN_PERSON', 'Presencial'
        VIDEO     = 'VIDEO',     'Videoconsulta'

    class Status(models.TextChoices):
        PENDING     = 'PENDING',     'Pendiente'
        CONFIRMED   = 'CONFIRMED',   'Confirmada'
        COMPLETED   = 'COMPLETED',   'Completada'
        CANCELLED   = 'CANCELLED',   'Cancelada'
        NO_SHOW     = 'NO_SHOW',     'No se presentó'
        RESCHEDULED = 'RESCHEDULED', 'Reagendada'

    id                  = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient             = models.ForeignKey(
        'accounts.PatientProfile', on_delete=models.CASCADE, related_name='appointments'
    )
    doctor              = models.ForeignKey(
        'accounts.DoctorProfile', on_delete=models.CASCADE, related_name='appointments'
    )
    appointment_type    = models.CharField(
        max_length=15, choices=AppointmentType.choices, default=AppointmentType.IN_PERSON
    )
    status              = models.CharField(
        max_length=15, choices=Status.choices, default=Status.PENDING, db_index=True
    )
    scheduled_at        = models.DateTimeField(db_index=True)
    duration_minutes    = models.PositiveIntegerField(default=30)
    reason              = models.TextField(blank=True)   # motivo de consulta (paciente)
    notes               = models.TextField(blank=True)   # notas internas del doctor
    video_link          = models.URLField(blank=True)    # Zoom/Meet URL
    location            = models.CharField(max_length=300, blank=True)  # dirección presencial
    reminder_24h_sent   = models.BooleanField(default=False)
    reminder_1h_sent    = models.BooleanField(default=False)
    cancelled_by        = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='cancelled_appointments'
    )
    cancellation_reason = models.TextField(blank=True)
    created_at          = models.DateTimeField(auto_now_add=True)
    updated_at          = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'appointments_appointment'
        ordering = ['-scheduled_at']
        indexes = [
            models.Index(fields=['patient', '-scheduled_at']),
            models.Index(fields=['doctor', '-scheduled_at']),
            models.Index(fields=['status', 'scheduled_at']),
        ]

    def __str__(self):
        return (
            f'{self.patient} → Dr. {self.doctor} '
            f'[{self.appointment_type}] {self.scheduled_at:%Y-%m-%d %H:%M} ({self.status})'
        )


class AppointmentNote(models.Model):
    """Clinical notes written by the doctor after the appointment."""
    id               = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    appointment      = models.OneToOneField(
        Appointment, on_delete=models.CASCADE, related_name='clinical_note'
    )
    chief_complaint  = models.TextField(blank=True)
    diagnosis        = models.TextField(blank=True)
    treatment_plan   = models.TextField(blank=True)
    follow_up_days   = models.PositiveIntegerField(null=True, blank=True)  # días hasta próxima cita
    prescriptions    = models.TextField(blank=True)   # resumen textual de recetas
    created_at       = models.DateTimeField(auto_now_add=True)
    updated_at       = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'appointments_note'

    def __str__(self):
        return f'Nota — {self.appointment}'
