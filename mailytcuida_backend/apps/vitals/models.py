import uuid
from django.db import models


class VitalSign(models.Model):
    class VitalType(models.TextChoices):
        # ── Cardiovascular ────────────────────────────────────────────────────
        BLOOD_PRESSURE = 'BLOOD_PRESSURE', 'Presión arterial'
        HEART_RATE     = 'HEART_RATE',     'Frecuencia cardíaca'
        OXYGEN_SAT     = 'OXYGEN_SAT',     'Saturación O₂'
        RESPIRATORY    = 'RESPIRATORY',    'Frecuencia respiratoria'
        # ── Metabólicos ───────────────────────────────────────────────────────
        GLUCOSE        = 'GLUCOSE',        'Glucosa'
        GLUCOSE_FAST   = 'GLUCOSE_FAST',   'Glucosa en ayuno'
        # ── Antropométricos ───────────────────────────────────────────────────
        WEIGHT         = 'WEIGHT',         'Peso'
        HEIGHT         = 'HEIGHT',         'Talla'
        BMI            = 'BMI',            'Índice de masa corporal'
        WAIST          = 'WAIST',          'Perímetro de cintura'
        HIP            = 'HIP',            'Perímetro de cadera'
        # ── Generales ─────────────────────────────────────────────────────────
        TEMPERATURE    = 'TEMPERATURE',    'Temperatura corporal'
        STEPS          = 'STEPS',          'Pasos'
        SLEEP_HOURS    = 'SLEEP_HOURS',    'Horas de sueño'

    class VitalSource(models.TextChoices):
        MANUAL      = 'MANUAL',      'Manual'
        DEVICE      = 'DEVICE',      'Dispositivo'
        INTEGRATION = 'INTEGRATION', 'Integración'

    # Default units per vital type
    UNIT_DEFAULTS = {
        'BLOOD_PRESSURE': 'mmHg',
        'HEART_RATE':     'bpm',
        'GLUCOSE':        'mg/dL',
        'GLUCOSE_FAST':   'mg/dL',
        'WEIGHT':         'kg',
        'HEIGHT':         'cm',
        'TEMPERATURE':    '°C',
        'OXYGEN_SAT':     '%',
        'RESPIRATORY':    'rpm',
        'WAIST':          'cm',
        'HIP':            'cm',
        'BMI':            'kg/m²',
        'STEPS':          'pasos',
        'SLEEP_HOURS':    'h',
    }

    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient         = models.ForeignKey(
        'accounts.PatientProfile', on_delete=models.CASCADE, related_name='vital_signs'
    )
    vital_type      = models.CharField(max_length=20, choices=VitalType.choices, db_index=True)
    # primary value; for BLOOD_PRESSURE → systolic
    value           = models.DecimalField(max_digits=8, decimal_places=2)
    # secondary value; for BLOOD_PRESSURE → diastolic
    secondary_value = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    unit            = models.CharField(max_length=20, blank=True)
    source          = models.CharField(
        max_length=15, choices=VitalSource.choices, default=VitalSource.MANUAL
    )
    notes           = models.TextField(blank=True)
    recorded_at     = models.DateTimeField(db_index=True)
    created_at      = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'vitals_vital_sign'
        ordering = ['-recorded_at']
        indexes = [
            models.Index(fields=['patient', 'vital_type', '-recorded_at']),
            models.Index(fields=['patient', '-recorded_at']),
        ]

    def save(self, *args, **kwargs):
        if not self.unit:
            self.unit = self.UNIT_DEFAULTS.get(self.vital_type, '')
        super().save(*args, **kwargs)

    def __str__(self):
        if self.secondary_value:
            return f'{self.get_vital_type_display()}: {self.value}/{self.secondary_value} {self.unit} @ {self.recorded_at:%Y-%m-%d %H:%M}'
        return f'{self.get_vital_type_display()}: {self.value} {self.unit} @ {self.recorded_at:%Y-%m-%d %H:%M}'


class VitalGoal(models.Model):
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient    = models.ForeignKey(
        'accounts.PatientProfile', on_delete=models.CASCADE, related_name='vital_goals'
    )
    vital_type = models.CharField(max_length=20, choices=VitalSign.VitalType.choices)
    # Normal range; either or both can be set
    min_value  = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    max_value  = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    # For BLOOD_PRESSURE secondary range (diastolic)
    min_secondary = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    max_secondary = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    set_by     = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL, null=True, blank=True, related_name='vital_goals_set'
    )
    notes      = models.TextField(blank=True)
    is_active  = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'vitals_goal'
        # One active goal per vital type per patient
        constraints = [
            models.UniqueConstraint(
                fields=['patient', 'vital_type'],
                condition=models.Q(is_active=True),
                name='unique_active_goal_per_vital',
            )
        ]

    def __str__(self):
        return f'{self.patient} — {self.vital_type} [{self.min_value}, {self.max_value}]'
