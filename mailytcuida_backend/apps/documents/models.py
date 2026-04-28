import uuid
from django.db import models
from django.conf import settings


class DocumentCategory(models.TextChoices):
    LAB_RESULT    = 'LAB_RESULT',    'Resultado de laboratorio'
    PRESCRIPTION  = 'PRESCRIPTION',  'Receta médica'
    IMAGING       = 'IMAGING',       'Imagen diagnóstica'
    CLINICAL_NOTE = 'CLINICAL_NOTE', 'Nota clínica'
    INSURANCE     = 'INSURANCE',     'Seguro / póliza'
    OTHER         = 'OTHER',         'Otro'


class DocumentStatus(models.TextChoices):
    PENDING    = 'PENDING',    'Pendiente de procesar'
    PROCESSING = 'PROCESSING', 'Procesando OCR'
    READY      = 'READY',      'Listo'
    FAILED     = 'FAILED',     'Error al procesar'


class MedicalDocument(models.Model):
    """
    Any file uploaded by the patient (PDF, image, etc.).
    Stored in S3 / Cloudflare R2; only the URL is persisted here.
    """
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient     = models.ForeignKey(
        'accounts.PatientProfile',
        on_delete=models.CASCADE,
        related_name='documents',
    )
    category    = models.CharField(
        max_length=20, choices=DocumentCategory.choices, default=DocumentCategory.OTHER
    )
    title       = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    file_url    = models.URLField(max_length=1024)
    file_name   = models.CharField(max_length=255, blank=True)
    file_size   = models.PositiveIntegerField(null=True, blank=True, help_text='Bytes')
    mime_type   = models.CharField(max_length=100, blank=True)
    status      = models.CharField(
        max_length=15, choices=DocumentStatus.choices, default=DocumentStatus.READY
    )
    # OCR extracted text (populated asynchronously)
    ocr_text    = models.TextField(blank=True)
    # Structured data extracted by OCR (e.g., lab values JSON)
    ocr_data    = models.JSONField(default=dict, blank=True)

    # Document date (e.g., date of the lab report, not upload date)
    document_date = models.DateField(null=True, blank=True)

    # Soft delete
    is_active   = models.BooleanField(default=True)

    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-document_date', '-created_at']
        indexes = [
            models.Index(fields=['patient', 'category']),
            models.Index(fields=['patient', 'created_at']),
        ]

    def __str__(self):
        return f'{self.patient} — {self.title} ({self.category})'


class DocumentShare(models.Model):
    """
    Grant a doctor read access to a specific document.
    Access is revocable by the patient at any time.
    """
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    document   = models.ForeignKey(
        MedicalDocument, on_delete=models.CASCADE, related_name='shares'
    )
    doctor     = models.ForeignKey(
        'accounts.DoctorProfile',
        on_delete=models.CASCADE,
        related_name='shared_documents',
    )
    shared_at  = models.DateTimeField(auto_now_add=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    is_active  = models.BooleanField(default=True)

    class Meta:
        unique_together = ('document', 'doctor')
        ordering = ['-shared_at']

    def __str__(self):
        return f'{self.document.title} → Dr. {self.doctor}'


class HealthSummaryExport(models.Model):
    """
    Track every PDF health-summary export requested by the patient.
    The generated PDF is stored in R2 and the URL returned to the client.
    """
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient    = models.ForeignKey(
        'accounts.PatientProfile',
        on_delete=models.CASCADE,
        related_name='health_exports',
    )
    pdf_url    = models.URLField(max_length=1024, blank=True)
    status     = models.CharField(
        max_length=15, choices=DocumentStatus.choices, default=DocumentStatus.PENDING
    )
    # Snapshot of what was included
    sections   = models.JSONField(default=list, blank=True,
                                  help_text='List of section names included in the export')
    error      = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'Export {self.patient} — {self.status} ({self.created_at:%Y-%m-%d})'
