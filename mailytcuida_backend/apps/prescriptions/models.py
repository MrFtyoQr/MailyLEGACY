"""
Prescription storage — patient side.

Two creation paths:
  1. Manual upload  — patient photographs a paper prescription and uploads it.
  2. MailySoft push — MailySoft webhook delivers a digitally-signed prescription
                      directly to the patient's record (source='MAILYSOFT').

MailySoft integration contract (future):
  POST /api/v1/prescriptions/webhook/receive/
  Headers: X-MailySoft-Signature: <HMAC-SHA256 of body with MAILYSOFT_WEBHOOK_SECRET>
  Body: see PrescriptionWebhookPayload in serializers.py
"""
import uuid
from django.db import models


class PrescriptionSource(models.TextChoices):
    MANUAL     = 'MANUAL',     'Subida manualmente por paciente'
    MAILYSOFT  = 'MAILYSOFT',  'Recibida desde MailySoft'


class PrescriptionStatus(models.TextChoices):
    ACTIVE   = 'ACTIVE',   'Vigente'
    EXPIRED  = 'EXPIRED',  'Vencida'
    USED     = 'USED',     'Utilizada'
    UNKNOWN  = 'UNKNOWN',  'Sin verificar'


class Prescription(models.Model):
    """
    A prescription stored by the patient.
    May originate from a manual photo upload or from a MailySoft push.
    """
    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient         = models.ForeignKey(
        'accounts.PatientProfile',
        on_delete=models.CASCADE,
        related_name='prescriptions',
    )

    # ── Origin ────────────────────────────────────────────────────────────
    source          = models.CharField(
        max_length=12, choices=PrescriptionSource.choices,
        default=PrescriptionSource.MANUAL,
    )

    # ── Document ──────────────────────────────────────────────────────────
    # File URL in R2 (photo or PDF). Required for MANUAL; optional for
    # MAILYSOFT if the PDF URL is delivered via webhook.
    file_url        = models.URLField(max_length=1024, blank=True)
    file_name       = models.CharField(max_length=255, blank=True)
    mime_type       = models.CharField(max_length=100, blank=True)
    thumbnail_url   = models.URLField(max_length=1024, blank=True,
                                      help_text='Low-res preview for list views')

    # ── Prescription metadata ─────────────────────────────────────────────
    title           = models.CharField(max_length=255, blank=True,
                                       help_text='Patient-assigned label, e.g. "Receta cardiólogo Feb 2026"')
    prescribed_by   = models.CharField(max_length=255, blank=True,
                                       help_text='Doctor name as written on the prescription')
    clinic_name     = models.CharField(max_length=255, blank=True)
    prescribed_at   = models.DateField(null=True, blank=True,
                                       help_text='Date printed on the prescription')
    expires_at      = models.DateField(null=True, blank=True)
    notes           = models.TextField(blank=True)
    status          = models.CharField(
        max_length=10, choices=PrescriptionStatus.choices,
        default=PrescriptionStatus.UNKNOWN,
    )

    # ── Medications listed (free text — no FK to Medication model) ────────
    # Structured list supplied by MailySoft or filled manually by patient.
    # Format: [{"name": "Metformina", "dose": "500 mg", "instructions": "1 c/8h"}]
    medications_listed = models.JSONField(default=list, blank=True)

    # ── MailySoft integration fields ──────────────────────────────────────
    # Opaque ID from MailySoft — used to deduplicate webhook deliveries.
    mailysoft_id    = models.CharField(max_length=128, blank=True, unique=True,
                                        null=True,  # null so multiple manual entries don't conflict
                                        help_text='MailySoft prescription UUID (null for MANUAL)')
    mailysoft_doctor_id = models.CharField(max_length=128, blank=True,
                                            help_text='MailySoft doctor UUID who issued it')
    mailysoft_clinic_id = models.CharField(max_length=128, blank=True)

    # Soft delete
    is_active       = models.BooleanField(default=True)

    created_at      = models.DateTimeField(auto_now_add=True)
    updated_at      = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-prescribed_at', '-created_at']
        indexes  = [
            models.Index(fields=['patient', 'status']),
            models.Index(fields=['patient', 'created_at']),
        ]

    def __str__(self):
        return (f'{self.patient} — {self.title or "Receta"} '
                f'({self.get_source_display()}, {self.prescribed_at})')


class PrescriptionVerification(models.Model):
    """
    QR / verification record for a digitally-issued prescription.

    The QR code in the patient's app encodes `verification_url` which
    points to a public endpoint that returns `is_valid`, `issued_by`, etc.
    This lets pharmacies or other doctors confirm authenticity without
    needing a MailySoft account.

    Only MAILYSOFT-sourced prescriptions have a verification record.
    Manual uploads do NOT (they are unverified by definition).
    """
    id                = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    prescription      = models.OneToOneField(
        Prescription, on_delete=models.CASCADE, related_name='verification'
    )
    # Short token embedded in the QR URL, e.g.  /api/v1/prescriptions/verify/<token>/
    token             = models.CharField(max_length=64, unique=True, db_index=True)
    verification_url  = models.URLField(max_length=1024, blank=True,
                                        help_text='Full public URL for QR scan')
    # Snapshot of what MailySoft certified
    issued_by_name    = models.CharField(max_length=255, blank=True)
    issued_by_license = models.CharField(max_length=128, blank=True,
                                          help_text='Professional license number')
    clinic_name       = models.CharField(max_length=255, blank=True)
    # HMAC signature provided by MailySoft for cryptographic verification
    signature         = models.TextField(blank=True)
    is_valid          = models.BooleanField(default=True)
    invalidated_at    = models.DateTimeField(null=True, blank=True,
                                              help_text='Set if MailySoft revokes the prescription')
    created_at        = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'Verification({self.token}) — {"✓" if self.is_valid else "✗"}'
