"""
Specialists marketplace — CAMSA model.

Actors:
  - DoctorProfile (M01) — the "lead doctor" who builds their team.
  - SpecialistProfile — any professional added to the network: specialist
    doctors, labs, clinics. They may or may not have a MailyT-Cuida account.
  - TeamMember — links a DoctorProfile to a SpecialistProfile they trust.
  - ReferralRequest — a doctor refers one of their patients to a specialist.

Design notes:
  - A SpecialistProfile can exist without a User account (external professionals
    added manually by the lead doctor). When they register on the platform,
    user is linked and their profile is verified.
  - Comission / booking monetization tracked via ReferralRequest.status.
"""
import uuid
from django.db import models


class SpecialtyArea(models.TextChoices):
    CARDIOLOGY      = 'CARDIOLOGY',      'Cardiología'
    ENDOCRINOLOGY   = 'ENDOCRINOLOGY',   'Endocrinología'
    NEUROLOGY       = 'NEUROLOGY',       'Neurología'
    DERMATOLOGY     = 'DERMATOLOGY',     'Dermatología'
    GYNECOLOGY      = 'GYNECOLOGY',      'Ginecología'
    PEDIATRICS      = 'PEDIATRICS',      'Pediatría'
    PSYCHIATRY      = 'PSYCHIATRY',      'Psiquiatría'
    ORTHOPEDICS     = 'ORTHOPEDICS',     'Ortopedia'
    OPHTHALMOLOGY   = 'OPHTHALMOLOGY',   'Oftalmología'
    NUTRITION       = 'NUTRITION',       'Nutrición'
    LABORATORY      = 'LABORATORY',      'Laboratorio clínico'
    IMAGING         = 'IMAGING',         'Imagen diagnóstica (Rayos X / MRI)'
    CLINIC          = 'CLINIC',          'Clínica general'
    PHARMACY        = 'PHARMACY',        'Farmacia'
    OTHER           = 'OTHER',           'Otro'


class SpecialistType(models.TextChoices):
    DOCTOR     = 'DOCTOR',     'Médico especialista'
    LAB        = 'LAB',        'Laboratorio'
    CLINIC     = 'CLINIC',     'Clínica'
    PHARMACY   = 'PHARMACY',   'Farmacia'
    OTHER      = 'OTHER',      'Otro'


class VerificationStatus(models.TextChoices):
    PENDING   = 'PENDING',   'Pendiente de verificación'
    VERIFIED  = 'VERIFIED',  'Verificado'
    REJECTED  = 'REJECTED',  'Rechazado'


class ReferralStatus(models.TextChoices):
    PENDING   = 'PENDING',   'Pendiente'
    ACCEPTED  = 'ACCEPTED',  'Aceptado por especialista'
    COMPLETED = 'COMPLETED', 'Consulta realizada'
    CANCELLED = 'CANCELLED', 'Cancelado'
    REJECTED  = 'REJECTED',  'Rechazado por especialista'


class SpecialistProfile(models.Model):
    """
    A professional or institution in the CAMSA network.
    May or may not have a platform account (user nullable).
    """
    id                  = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)

    # Linked platform account (optional — external professionals may not have one yet)
    user                = models.OneToOneField(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='camsa_specialist_profile',
    )

    specialist_type     = models.CharField(
        max_length=10, choices=SpecialistType.choices, default=SpecialistType.DOCTOR
    )
    specialty_area      = models.CharField(
        max_length=20, choices=SpecialtyArea.choices, default=SpecialtyArea.OTHER
    )

    # Identity
    name                = models.CharField(max_length=255,
                                           help_text='Full name or institution name')
    license_number      = models.CharField(max_length=128, blank=True,
                                           help_text='Cédula profesional / registro sanitario')
    bio                 = models.TextField(blank=True)
    avatar_url          = models.URLField(max_length=1024, blank=True)

    # Contact & location
    email               = models.EmailField(blank=True)
    phone               = models.CharField(max_length=20, blank=True)
    address             = models.TextField(blank=True)
    city                = models.CharField(max_length=100, blank=True)
    state               = models.CharField(max_length=100, blank=True)
    website             = models.URLField(max_length=512, blank=True)

    # Schedule / pricing (informational — booking done via Appointments M06)
    consultation_fee_mxn = models.DecimalField(
        max_digits=8, decimal_places=2, null=True, blank=True
    )
    accepts_insurance   = models.BooleanField(default=False)
    languages           = models.JSONField(default=list, blank=True,
                                           help_text='["es", "en"]')

    # Verification
    verification_status = models.CharField(
        max_length=10, choices=VerificationStatus.choices,
        default=VerificationStatus.PENDING,
    )
    verified_at         = models.DateTimeField(null=True, blank=True)
    verified_by         = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='verified_specialists',
    )

    is_active           = models.BooleanField(default=True)
    created_at          = models.DateTimeField(auto_now_add=True)
    updated_at          = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']
        indexes  = [
            models.Index(fields=['specialty_area', 'is_active']),
            models.Index(fields=['specialist_type', 'is_active']),
            models.Index(fields=['verification_status']),
        ]

    def __str__(self):
        return f'{self.name} ({self.get_specialty_area_display()})'


class TeamMember(models.Model):
    """
    A specialist trusted and endorsed by a lead doctor.
    The doctor curates their own network — patients see only
    specialists their doctor has added.
    """
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    doctor      = models.ForeignKey(
        'accounts.DoctorProfile',
        on_delete=models.CASCADE,
        related_name='team_members',
    )
    specialist  = models.ForeignKey(
        SpecialistProfile,
        on_delete=models.CASCADE,
        related_name='team_memberships',
    )
    # Doctor's personal note about this specialist (visible only to the doctor)
    note        = models.TextField(blank=True)
    is_active   = models.BooleanField(default=True)
    added_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('doctor', 'specialist')
        ordering        = ['-added_at']

    def __str__(self):
        return f'Dr. {self.doctor} → {self.specialist.name}'


class ReferralRequest(models.Model):
    """
    A doctor refers one of their patients to a specialist.
    Tracks the booking lifecycle and is the basis for future commission logic.
    """
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    doctor      = models.ForeignKey(
        'accounts.DoctorProfile',
        on_delete=models.CASCADE,
        related_name='referrals_sent',
    )
    patient     = models.ForeignKey(
        'accounts.PatientProfile',
        on_delete=models.CASCADE,
        related_name='referrals_received',
    )
    specialist  = models.ForeignKey(
        SpecialistProfile,
        on_delete=models.CASCADE,
        related_name='referrals',
    )
    status      = models.CharField(
        max_length=10, choices=ReferralStatus.choices,
        default=ReferralStatus.PENDING,
    )
    reason      = models.TextField(help_text='Clinical reason for the referral')
    urgency     = models.CharField(
        max_length=10,
        choices=[('LOW', 'Baja'), ('MEDIUM', 'Media'), ('HIGH', 'Alta')],
        default='MEDIUM',
    )
    # Doctor's clinical notes shared with the specialist (with patient consent)
    clinical_notes = models.TextField(blank=True)
    # Specialist's response / counter-notes
    specialist_notes = models.TextField(blank=True)
    # Linked appointment once the specialist accepts
    appointment = models.OneToOneField(
        'appointments.Appointment',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='referral',
    )
    # Patient consent to share clinical notes with specialist
    patient_consent = models.BooleanField(default=False)

    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)
    accepted_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']
        indexes  = [
            models.Index(fields=['doctor', 'status']),
            models.Index(fields=['patient', 'status']),
            models.Index(fields=['specialist', 'status']),
        ]

    def __str__(self):
        return (f'Referral {self.patient} → {self.specialist.name} '
                f'[{self.get_status_display()}]')


class SpecialistReview(models.Model):
    """
    Patient review of a specialist after a completed referral.
    One review per completed referral.
    """
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    referral    = models.OneToOneField(
        ReferralRequest,
        on_delete=models.CASCADE,
        related_name='review',
    )
    patient     = models.ForeignKey(
        'accounts.PatientProfile',
        on_delete=models.CASCADE,
        related_name='specialist_reviews',
    )
    specialist  = models.ForeignKey(
        SpecialistProfile,
        on_delete=models.CASCADE,
        related_name='reviews',
    )
    rating      = models.PositiveSmallIntegerField(
        help_text='1–5 stars'
    )
    comment     = models.TextField(blank=True)
    is_public   = models.BooleanField(default=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def clean(self):
        from django.core.exceptions import ValidationError
        if not (1 <= self.rating <= 5):
            raise ValidationError('Rating must be between 1 and 5.')
        if self.referral.status != ReferralStatus.COMPLETED:
            raise ValidationError('Only completed referrals can be reviewed.')

    def __str__(self):
        return f'Review {self.specialist.name} ★{self.rating} by {self.patient}'
