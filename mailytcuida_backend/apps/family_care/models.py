import uuid
from django.db import models


class FamilyCareLink(models.Model):
    class Relationship(models.TextChoices):
        PARENT  = 'PARENT',  'Padre/Madre cuida a hijo/a'
        CHILD   = 'CHILD',   'Hijo/a cuida a padre/madre'
        SPOUSE  = 'SPOUSE',  'Cónyuge'
        SIBLING = 'SIBLING', 'Hermano/a'
        OTHER   = 'OTHER',   'Otro'

    class Status(models.TextChoices):
        PENDING_CONSENT = 'PENDING_CONSENT', 'Esperando consentimiento'
        ACTIVE          = 'ACTIVE',          'Activo'
        REVOKED         = 'REVOKED',         'Revocado'

    id               = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    caregiver        = models.ForeignKey(
        'accounts.User', on_delete=models.CASCADE, related_name='care_links_as_caregiver'
    )
    patient          = models.ForeignKey(
        'accounts.User', on_delete=models.CASCADE, related_name='care_links_as_patient'
    )
    relationship_type = models.CharField(max_length=10, choices=Relationship.choices)
    status           = models.CharField(
        max_length=20, choices=Status.choices, default=Status.PENDING_CONSENT, db_index=True
    )
    permissions      = models.JSONField(default=dict)
    requested_at     = models.DateTimeField(auto_now_add=True)
    consent_at       = models.DateTimeField(null=True, blank=True)
    revoked_at       = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'family_care_link'
        constraints = [
            models.UniqueConstraint(fields=('caregiver', 'patient'), name='unique_caregiver_patient')
        ]

    def __str__(self):
        return f'{self.caregiver.email} → {self.patient.email} [{self.status}]'

    @property
    def relationship_display(self):
        return self.get_relationship_type_display()

    @property
    def status_display(self):
        return self.get_status_display()


class VitalMonitorConfig(models.Model):
    id                      = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    care_link               = models.ForeignKey(
        FamilyCareLink, on_delete=models.CASCADE, related_name='monitor_configs'
    )
    vital_type              = models.CharField(max_length=20)
    reminder_frequency_hours = models.PositiveIntegerField(default=24)
    last_patient_reading_at = models.DateTimeField(null=True, blank=True)
    last_reminder_sent_at   = models.DateTimeField(null=True, blank=True)
    is_active               = models.BooleanField(default=True)
    created_at              = models.DateTimeField(auto_now_add=True)
    updated_at              = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'family_care_vital_monitor_config'
        constraints = [
            models.UniqueConstraint(
                fields=('care_link', 'vital_type'), name='unique_monitor_vital_per_link'
            )
        ]

    def __str__(self):
        return f'{self.care_link} | {self.vital_type} cada {self.reminder_frequency_hours}h'

    @property
    def vital_type_display(self):
        from apps.vitals.models import VitalSign
        return dict(VitalSign.Type.choices).get(self.vital_type, self.vital_type)


class CareAlert(models.Model):
    class AlertType(models.TextChoices):
        VITAL_ABNORMAL    = 'VITAL_ABNORMAL',    'Vital fuera de rango'
        VITAL_OVERDUE     = 'VITAL_OVERDUE',     'Vital no registrado'
        MEDICATION_MISSED = 'MEDICATION_MISSED', 'Medicamento no tomado'

    class Severity(models.TextChoices):
        LOW      = 'LOW',      'Baja'
        MEDIUM   = 'MEDIUM',   'Media'
        HIGH     = 'HIGH',     'Alta'
        CRITICAL = 'CRITICAL', 'Crítica'

    class Status(models.TextChoices):
        OPEN              = 'OPEN',              'Abierta'
        DISPATCHED_DOCTOR = 'DISPATCHED_DOCTOR', 'Médico despachado'
        DISMISSED         = 'DISMISSED',         'Descartada'

    id                  = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    care_link           = models.ForeignKey(
        FamilyCareLink, on_delete=models.CASCADE, related_name='alerts'
    )
    alert_type          = models.CharField(max_length=20, choices=AlertType.choices, db_index=True)
    vital_sign          = models.ForeignKey(
        'vitals.VitalSign', on_delete=models.SET_NULL, null=True, blank=True
    )
    vital_type          = models.CharField(max_length=20, blank=True)
    medication_history  = models.ForeignKey(
        'medications.MedicationHistory', on_delete=models.SET_NULL, null=True, blank=True
    )
    severity            = models.CharField(max_length=10, choices=Severity.choices, db_index=True)
    status              = models.CharField(
        max_length=20, choices=Status.choices, default=Status.OPEN, db_index=True
    )
    dismissed_by        = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='dismissed_alerts'
    )
    appointment         = models.ForeignKey(
        'appointments.Appointment', on_delete=models.SET_NULL, null=True, blank=True
    )
    notes               = models.TextField(blank=True)
    created_at          = models.DateTimeField(auto_now_add=True)
    resolved_at         = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'family_care_alert'
        ordering = ['-created_at']

    def __str__(self):
        return f'[{self.alert_type}/{self.severity}] {self.care_link}'


class MedicationPayment(models.Model):
    class Status(models.TextChoices):
        PENDING  = 'PENDING',  'Pendiente'
        PAID     = 'PAID',     'Pagado'
        FAILED   = 'FAILED',   'Fallido'
        REFUNDED = 'REFUNDED', 'Reembolsado'

    id                      = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    care_link               = models.ForeignKey(
        FamilyCareLink, on_delete=models.CASCADE, related_name='medication_payments'
    )
    prescription            = models.ForeignKey(
        'prescriptions.Prescription', on_delete=models.SET_NULL, null=True, blank=True
    )
    medication              = models.ForeignKey(
        'medications.Medication', on_delete=models.SET_NULL, null=True, blank=True
    )
    description             = models.CharField(max_length=255)
    amount_mxn              = models.DecimalField(max_digits=10, decimal_places=2)
    stripe_payment_intent_id = models.CharField(max_length=100, blank=True)
    status                  = models.CharField(
        max_length=10, choices=Status.choices, default=Status.PENDING, db_index=True
    )
    paid_at                 = models.DateTimeField(null=True, blank=True)
    created_at              = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'family_care_medication_payment'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.care_link} | {self.description} | {self.status}'
