import uuid
from django.db import models


class LabPanel(models.Model):
    """
    Optional grouping for a single lab visit. LabResults can exist without a panel
    to allow individual entry (patient saves one value at a time).
    """
    class Source(models.TextChoices):
        MANUAL      = 'MANUAL',      'Manual'
        OCR         = 'OCR',         'Escáner OCR'
        INTEGRATION = 'INTEGRATION', 'Integración'

    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient      = models.ForeignKey(
        'accounts.PatientProfile', on_delete=models.CASCADE, related_name='lab_panels'
    )
    lab_name     = models.CharField(max_length=200, blank=True)   # "Laboratorio Chopo"
    panel_name   = models.CharField(max_length=200, blank=True)   # "Química 24 elementos"
    performed_at = models.DateField()
    source       = models.CharField(max_length=15, choices=Source.choices, default=Source.MANUAL)
    file_url     = models.URLField(blank=True)  # PDF/imagen subida
    notes        = models.TextField(blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'lab_panel'
        ordering = ['-performed_at']

    def __str__(self):
        return f'{self.patient} — {self.panel_name or "Panel"} ({self.performed_at})'


class LabResult(models.Model):
    """
    Single lab parameter value. Can belong to a LabPanel or stand alone.
    Status is auto-computed when ref_min/ref_max are provided.
    """
    class Status(models.TextChoices):
        NORMAL        = 'NORMAL',        'Normal'
        ABNORMAL_LOW  = 'ABNORMAL_LOW',  'Bajo'
        ABNORMAL_HIGH = 'ABNORMAL_HIGH', 'Alto'
        CRITICAL      = 'CRITICAL',      'Crítico'
        UNKNOWN       = 'UNKNOWN',       'Sin referencia'

    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient         = models.ForeignKey(
        'accounts.PatientProfile', on_delete=models.CASCADE, related_name='lab_results'
    )
    panel           = models.ForeignKey(
        LabPanel, on_delete=models.CASCADE, null=True, blank=True, related_name='results'
    )
    # Parameter identification
    parameter       = models.CharField(max_length=200)          # "Triglicéridos"
    parameter_code  = models.CharField(max_length=50, blank=True)  # LOINC/SNOMED code (optional)
    # Value
    value           = models.DecimalField(max_digits=10, decimal_places=3)
    unit            = models.CharField(max_length=50, blank=True)   # "mg/dL"
    # Reference range from the lab report
    ref_min         = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True)
    ref_max         = models.DecimalField(max_digits=10, decimal_places=3, null=True, blank=True)
    ref_text        = models.CharField(max_length=100, blank=True)  # e.g. "<200" if non-numeric
    # Auto-computed or manually set
    status          = models.CharField(
        max_length=15, choices=Status.choices, default=Status.UNKNOWN
    )
    performed_at    = models.DateField(db_index=True)
    notes           = models.TextField(blank=True)
    created_at      = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'lab_result'
        ordering = ['-performed_at', 'parameter']
        indexes = [
            models.Index(fields=['patient', 'parameter', '-performed_at']),
            models.Index(fields=['patient', 'status', '-performed_at']),
        ]

    def save(self, *args, **kwargs):
        self.status = self._compute_status()
        super().save(*args, **kwargs)

    def _compute_status(self) -> str:
        if self.ref_min is None and self.ref_max is None:
            return self.Status.UNKNOWN
        low  = self.ref_min is not None and self.value < self.ref_min
        high = self.ref_max is not None and self.value > self.ref_max
        if not low and not high:
            return self.Status.NORMAL
        # Critical thresholds: >50% outside range
        if self.ref_min is not None and low:
            pct = (self.ref_min - self.value) / self.ref_min if self.ref_min else 0
            return self.Status.CRITICAL if pct > 0.5 else self.Status.ABNORMAL_LOW
        if self.ref_max is not None and high:
            pct = (self.value - self.ref_max) / self.ref_max if self.ref_max else 0
            return self.Status.CRITICAL if pct > 0.5 else self.Status.ABNORMAL_HIGH
        return self.Status.UNKNOWN

    def __str__(self):
        return f'{self.parameter}: {self.value} {self.unit} ({self.status}) — {self.performed_at}'


class LabRec(models.Model):
    """Recommendation generated for an abnormal LabResult."""
    class RecType(models.TextChoices):
        DIET       = 'DIET',       'Alimentación'
        EXERCISE   = 'EXERCISE',   'Ejercicio'
        LIFESTYLE  = 'LIFESTYLE',  'Estilo de vida'
        FOLLOW_UP  = 'FOLLOW_UP',  'Seguimiento médico'
        MEDICATION = 'MEDICATION', 'Medicamento'

    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    result     = models.ForeignKey(LabResult, on_delete=models.CASCADE, related_name='recommendations')
    rec_type   = models.CharField(max_length=15, choices=RecType.choices)
    message    = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'lab_recommendation'
        ordering = ['rec_type']

    def __str__(self):
        return f'[{self.rec_type}] {self.result.parameter} — {self.message[:60]}'
