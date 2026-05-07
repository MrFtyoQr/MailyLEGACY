import uuid
from django.db import models


class DeviceToken(models.Model):
    class Platform(models.TextChoices):
        ANDROID = 'ANDROID', 'Android'
        IOS     = 'IOS',     'iOS'
        WEB     = 'WEB',     'Web'

    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user       = models.ForeignKey(
        'accounts.User', on_delete=models.CASCADE, related_name='device_tokens'
    )
    token      = models.TextField()
    platform   = models.CharField(max_length=10, choices=Platform.choices)
    is_active  = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'notifications_device_token'
        # Unique active token per device (upsert on re-register)
        constraints = [
            models.UniqueConstraint(
                fields=['user', 'token'],
                name='unique_user_token',
            )
        ]

    def __str__(self):
        return f'{self.user.email} [{self.platform}] {"✓" if self.is_active else "✗"}'


class Notification(models.Model):
    class Channel(models.TextChoices):
        PUSH   = 'PUSH',   'Push'
        EMAIL  = 'EMAIL',  'Email'
        IN_APP = 'IN_APP', 'In-App'

    class Status(models.TextChoices):
        PENDING   = 'PENDING',   'Pendiente'
        SENT      = 'SENT',      'Enviada'
        FAILED    = 'FAILED',    'Fallida'
        READ      = 'READ',      'Leída'

    # Notification codes — any module that calls notify() uses these
    class Code(models.TextChoices):
        MEDICATION_REMINDER      = 'MEDICATION_REMINDER',      'Recordatorio de medicamento'
        MEDICATION_LOW_ADHERENCE = 'MEDICATION_LOW_ADHERENCE', 'Baja adherencia'
        APPOINTMENT_CONFIRMED    = 'APPOINTMENT_CONFIRMED',    'Cita confirmada'
        APPOINTMENT_REMINDER_24H = 'APPOINTMENT_REMINDER_24H', 'Recordatorio 24h'
        APPOINTMENT_REMINDER_1H  = 'APPOINTMENT_REMINDER_1H',  'Recordatorio 1h'
        APPOINTMENT_CANCELLED    = 'APPOINTMENT_CANCELLED',    'Cita cancelada'
        APPOINTMENT_RESCHEDULED  = 'APPOINTMENT_RESCHEDULED',  'Cita reagendada'
        VITAL_ABNORMAL           = 'VITAL_ABNORMAL',           'Vital fuera de rango'
        LAB_RESULT_ABNORMAL      = 'LAB_RESULT_ABNORMAL',      'Resultado anormal'
        DOCTOR_MESSAGE           = 'DOCTOR_MESSAGE',           'Mensaje del doctor'
        PRESCRIPTION_RECEIVED    = 'PRESCRIPTION_RECEIVED',    'Receta recibida'
        BADGE_EARNED             = 'BADGE_EARNED',             'Badge desbloqueado'
        PARTNER_ENROLLED         = 'PARTNER_ENROLLED',         'Alta en programa corporativo'
        VIDEO_SESSION_READY      = 'VIDEO_SESSION_READY',      'Sesión de video lista'
        PATIENT_WAITING          = 'PATIENT_WAITING',          'Paciente en sala de espera'
        REFERRAL_RECEIVED        = 'REFERRAL_RECEIVED',        'Referido recibido'
        REFERRAL_STATUS_CHANGED  = 'REFERRAL_STATUS_CHANGED',  'Estado de referido actualizado'
        PAYMENT_FAILED           = 'PAYMENT_FAILED',           'Pago fallido'
        SURVEY_ASSIGNED          = 'SURVEY_ASSIGNED',          'Nueva encuesta asignada'
        SURVEY_COMPLETED         = 'SURVEY_COMPLETED',         'Encuesta completada'
        NUTRITION_PLAN_ASSIGNED  = 'NUTRITION_PLAN_ASSIGNED',  'Plan nutricional asignado'
        WELLNESS_PROGRAM_ENROLLED   = 'WELLNESS_PROGRAM_ENROLLED',   'Inscripción a programa de bienestar'
        WELLNESS_PROGRAM_COMPLETED  = 'WELLNESS_PROGRAM_COMPLETED',  'Programa de bienestar completado'
        WELCOME                  = 'WELCOME',                  'Bienvenida'
        FAMILY_CARE_REQUEST      = 'FAMILY_CARE_REQUEST',      'Solicitud de cuidado familiar'
        FAMILY_VITAL_REMINDER    = 'FAMILY_VITAL_REMINDER',    'Recordatorio de signo vital'
        FAMILY_DOCTOR_DISPATCHED = 'FAMILY_DOCTOR_DISPATCHED', 'Médico despachado por familiar'
        FAMILY_PAYMENT_RECEIVED  = 'FAMILY_PAYMENT_RECEIVED',  'Pago de medicamento recibido'

    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user       = models.ForeignKey(
        'accounts.User', on_delete=models.CASCADE, related_name='notifications'
    )
    code       = models.CharField(max_length=30, choices=Code.choices, db_index=True)
    channel    = models.CharField(max_length=10, choices=Channel.choices)
    title      = models.CharField(max_length=255)
    body       = models.TextField()
    data       = models.JSONField(default=dict, blank=True)  # deep-link payload
    status     = models.CharField(
        max_length=10, choices=Status.choices, default=Status.PENDING, db_index=True
    )
    sent_at    = models.DateTimeField(null=True, blank=True)
    read_at    = models.DateTimeField(null=True, blank=True)
    error      = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'notifications_notification'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['user', 'status', '-created_at']),
        ]

    def __str__(self):
        return f'[{self.code}] → {self.user.email} ({self.status})'
