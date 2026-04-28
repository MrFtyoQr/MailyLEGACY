import uuid
from django.db import models
from django.utils import timezone


class Medication(models.Model):
    id               = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient          = models.ForeignKey(
        'accounts.PatientProfile', on_delete=models.CASCADE, related_name='medications'
    )
    name             = models.CharField(max_length=200)
    active_compound  = models.CharField(max_length=200, blank=True)
    dosage           = models.CharField(max_length=100, blank=True)
    unit             = models.CharField(max_length=50, blank=True)  # mg, ml, comprimido
    notes            = models.TextField(blank=True)
    is_active        = models.BooleanField(default=True)
    created_at       = models.DateTimeField(auto_now_add=True)
    updated_at       = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'medications_medication'
        ordering = ['name']

    def __str__(self):
        return f'{self.name} ({self.dosage} {self.unit})'


class MedicationPattern(models.Model):
    class PatternType(models.TextChoices):
        DAILY         = 'DAILY',         'Diario'
        WEEKLY        = 'WEEKLY',        'Semanal'
        CUSTOM        = 'CUSTOM',        'Personalizado'
        SPECIFIC_DAYS = 'SPECIFIC_DAYS', 'Días específicos'

    id                   = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    medication           = models.ForeignKey(Medication, on_delete=models.CASCADE, related_name='patterns')
    pattern_type         = models.CharField(max_length=20, choices=PatternType.choices)
    is_active            = models.BooleanField(default=True)
    repeat_every_days    = models.PositiveIntegerField(null=True, blank=True)
    repeat_for_days      = models.PositiveIntegerField(null=True, blank=True)
    specific_days_of_week = models.JSONField(default=list, blank=True)  # [0..6] lun=0
    pause_start_date     = models.DateField(null=True, blank=True)
    pause_end_date       = models.DateField(null=True, blank=True)
    pause_duration_days  = models.PositiveIntegerField(null=True, blank=True)
    pause_interval_days  = models.PositiveIntegerField(null=True, blank=True)
    created_at           = models.DateTimeField(auto_now_add=True)
    updated_at           = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'medications_pattern'

    def __str__(self):
        return f'{self.medication.name} — {self.pattern_type}'


class MealSchedule(models.Model):
    class MealType(models.TextChoices):
        BREAKFAST = 'BREAKFAST', 'Desayuno'
        LUNCH     = 'LUNCH',     'Comida'
        DINNER    = 'DINNER',    'Cena'
        SNACK     = 'SNACK',     'Colación'

    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient    = models.ForeignKey(
        'accounts.PatientProfile', on_delete=models.CASCADE, related_name='meal_schedules'
    )
    meal_name  = models.CharField(max_length=100, blank=True)
    meal_type  = models.CharField(max_length=20, choices=MealType.choices)
    time       = models.TimeField()
    is_active  = models.BooleanField(default=True)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'medications_meal_schedule'
        ordering = ['time']

    def __str__(self):
        return f'{self.get_meal_type_display()} — {self.time}'


class MedicationSchedule(models.Model):
    class MealType(models.TextChoices):
        BREAKFAST = 'BREAKFAST', 'Desayuno'
        LUNCH     = 'LUNCH',     'Comida'
        DINNER    = 'DINNER',    'Cena'
        SNACK     = 'SNACK',     'Colación'

    id                      = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    medication              = models.ForeignKey(Medication, on_delete=models.CASCADE, related_name='schedules')
    pattern                 = models.ForeignKey(
        MedicationPattern, on_delete=models.SET_NULL, null=True, blank=True, related_name='schedules'
    )
    time                    = models.TimeField()
    is_relative_to_meal     = models.BooleanField(default=False)
    meal_type               = models.CharField(max_length=20, choices=MealType.choices, blank=True)
    offset_minutes          = models.IntegerField(default=0)
    reminder_minutes_before = models.PositiveIntegerField(default=15)
    is_active               = models.BooleanField(default=True)
    created_at              = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'medications_schedule'
        ordering = ['time']

    def __str__(self):
        return f'{self.medication.name} — {self.time}'


class MedicationHistory(models.Model):
    class Status(models.TextChoices):
        PENDING   = 'PENDING',   'Pendiente'
        TAKEN     = 'TAKEN',     'Tomado'
        SKIPPED   = 'SKIPPED',   'Omitido'
        POSTPONED = 'POSTPONED', 'Pospuesto'

    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient         = models.ForeignKey(
        'accounts.PatientProfile', on_delete=models.CASCADE, related_name='medication_history'
    )
    medication      = models.ForeignKey(
        Medication, on_delete=models.CASCADE, related_name='history'
    )
    schedule        = models.ForeignKey(
        MedicationSchedule, on_delete=models.SET_NULL, null=True, blank=True
    )
    # Desnormalizado para preservar historial si se cambia el nombre
    medication_name = models.CharField(max_length=200)
    scheduled_at    = models.DateTimeField(db_index=True)
    actual_taken_at = models.DateTimeField(null=True, blank=True)
    reminder_sent_at = models.DateTimeField(null=True, blank=True)
    status          = models.CharField(max_length=20, choices=Status.choices, default=Status.PENDING)
    dosage_taken    = models.CharField(max_length=100, blank=True)
    notes           = models.TextField(blank=True)
    side_effects    = models.TextField(blank=True)
    created_at      = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'medications_history'
        ordering = ['-scheduled_at']
        indexes = [
            models.Index(fields=['patient', '-scheduled_at']),
            models.Index(fields=['status', 'scheduled_at']),
        ]

    def __str__(self):
        return f'{self.medication_name} — {self.scheduled_at:%Y-%m-%d %H:%M} ({self.status})'
