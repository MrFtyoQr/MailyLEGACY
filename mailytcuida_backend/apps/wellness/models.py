"""
Wellness — programs, daily check-ins, mood tracking and sleep logs.

Entities:
  WellnessProgram    — template created by staff (meditation, exercise, etc.)
  ProgramEnrollment  — patient enrolled in a program
  WellnessActivity   — individual activity within a program (video, article, exercise)
  ActivityCompletion — patient marks an activity as done (gamification hook)
  MoodEntry          — daily mood check-in (1-10 + emotion tags + note)
  SleepEntry         — sleep log (duration, quality)
  DailyCheckin       — single record per patient per day: aggregates mood + sleep
"""
import uuid
from django.db import models


class ProgramCategory(models.TextChoices):
    MENTAL_HEALTH = 'MENTAL_HEALTH', 'Salud mental'
    STRESS        = 'STRESS',        'Manejo del estrés'
    SLEEP         = 'SLEEP',         'Calidad del sueño'
    EXERCISE      = 'EXERCISE',      'Actividad física'
    MINDFULNESS   = 'MINDFULNESS',   'Mindfulness'
    CHRONIC       = 'CHRONIC',       'Condición crónica'
    CUSTOM        = 'CUSTOM',        'Personalizado'


class ActivityType(models.TextChoices):
    VIDEO      = 'VIDEO',      'Video'
    AUDIO      = 'AUDIO',      'Audio / Meditación guiada'
    ARTICLE    = 'ARTICLE',    'Artículo'
    EXERCISE   = 'EXERCISE',   'Ejercicio'
    BREATHING  = 'BREATHING',  'Respiración'
    JOURNALING = 'JOURNALING', 'Diario reflexivo'
    QUIZ       = 'QUIZ',       'Cuestionario'


class MoodLabel(models.TextChoices):
    EXCELLENT = 'EXCELLENT', 'Excelente'
    GOOD      = 'GOOD',      'Bien'
    NEUTRAL   = 'NEUTRAL',   'Neutral'
    LOW       = 'LOW',       'Bajo'
    ANXIOUS   = 'ANXIOUS',   'Ansioso/a'
    STRESSED  = 'STRESSED',  'Estresado/a'
    SAD       = 'SAD',       'Triste'
    ANGRY     = 'ANGRY',     'Enojado/a'


class SleepQuality(models.TextChoices):
    GREAT   = 'GREAT',   'Excelente'
    GOOD    = 'GOOD',    'Buena'
    FAIR    = 'FAIR',    'Regular'
    POOR    = 'POOR',    'Mala'
    INSOMNIA = 'INSOMNIA', 'Insomnio'


# ── Program & Activities ──────────────────────────────────────────────────────

class WellnessProgram(models.Model):
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title       = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    category    = models.CharField(max_length=20, choices=ProgramCategory.choices,
                                   default=ProgramCategory.CUSTOM)
    duration_days = models.PositiveSmallIntegerField(default=21,
                                                     help_text='Total program length in days.')
    thumbnail_url = models.URLField(blank=True)
    created_by  = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='created_wellness_programs',
    )
    is_active   = models.BooleanField(default=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.title} ({self.category})'


class WellnessActivity(models.Model):
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    program     = models.ForeignKey(WellnessProgram, on_delete=models.CASCADE,
                                    related_name='activities')
    order       = models.PositiveSmallIntegerField(default=0)
    day_number  = models.PositiveSmallIntegerField(default=1)
    title       = models.CharField(max_length=255)
    activity_type = models.CharField(max_length=15, choices=ActivityType.choices)
    content_url = models.URLField(blank=True, help_text='Link to video/audio/article.')
    body        = models.TextField(blank=True, help_text='Inline text content if no URL.')
    duration_min = models.PositiveSmallIntegerField(
        null=True, blank=True, help_text='Estimated minutes to complete.'
    )
    points_reward = models.PositiveSmallIntegerField(
        default=0, help_text='Points awarded via gamification on completion.'
    )

    class Meta:
        ordering = ['day_number', 'order']

    def __str__(self):
        return f'[{self.program.title}] Day {self.day_number}: {self.title}'


# ── Enrollment ────────────────────────────────────────────────────────────────

class ProgramEnrollment(models.Model):
    class Status(models.TextChoices):
        ACTIVE    = 'ACTIVE',    'Activo'
        PAUSED    = 'PAUSED',    'Pausado'
        COMPLETED = 'COMPLETED', 'Completado'
        ABANDONED = 'ABANDONED', 'Abandonado'

    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    program     = models.ForeignKey(WellnessProgram, on_delete=models.CASCADE,
                                    related_name='enrollments')
    patient     = models.ForeignKey(
        'accounts.PatientProfile', on_delete=models.CASCADE,
        related_name='wellness_enrollments',
    )
    enrolled_by = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='wellness_enrollments_sent',
    )
    status      = models.CharField(max_length=10, choices=Status.choices,
                                   default=Status.ACTIVE, db_index=True)
    start_date  = models.DateField()
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        # A patient can only be actively enrolled in each program once
        unique_together = ('program', 'patient')

    def __str__(self):
        return f'{self.patient} → {self.program.title} ({self.status})'


class ActivityCompletion(models.Model):
    """Patient marks a WellnessActivity as done."""
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    enrollment  = models.ForeignKey(ProgramEnrollment, on_delete=models.CASCADE,
                                    related_name='completions')
    activity    = models.ForeignKey(WellnessActivity, on_delete=models.CASCADE,
                                    related_name='completions')
    completed_at = models.DateTimeField(auto_now_add=True)
    note        = models.CharField(max_length=500, blank=True)

    class Meta:
        unique_together = ('enrollment', 'activity')

    def __str__(self):
        return f'{self.enrollment.patient} ✓ {self.activity.title}'


# ── Mood Tracking ─────────────────────────────────────────────────────────────

class MoodEntry(models.Model):
    """Daily mood check-in."""
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient     = models.ForeignKey(
        'accounts.PatientProfile', on_delete=models.CASCADE,
        related_name='mood_entries',
    )
    logged_at   = models.DateTimeField()
    score       = models.PositiveSmallIntegerField(
        help_text='1 (very low) to 10 (excellent).'
    )
    label       = models.CharField(max_length=15, choices=MoodLabel.choices, blank=True)
    # List of emotion tags: ['ansiedad', 'cansancio', ...]
    tags        = models.JSONField(default=list, blank=True)
    note        = models.TextField(blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-logged_at']
        indexes = [models.Index(fields=['patient', '-logged_at'])]

    def __str__(self):
        return f'{self.patient} mood={self.score} — {self.logged_at.date()}'

    def clean(self):
        from django.core.exceptions import ValidationError
        if not (1 <= self.score <= 10):
            raise ValidationError({'score': 'El puntaje de ánimo debe ser entre 1 y 10.'})


# ── Sleep Tracking ────────────────────────────────────────────────────────────

class SleepEntry(models.Model):
    """Sleep log per night."""
    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient         = models.ForeignKey(
        'accounts.PatientProfile', on_delete=models.CASCADE,
        related_name='sleep_entries',
    )
    sleep_date      = models.DateField(help_text='The date the patient went to sleep.')
    bedtime         = models.TimeField(null=True, blank=True)
    wake_time       = models.TimeField(null=True, blank=True)
    duration_hours  = models.DecimalField(max_digits=4, decimal_places=1,
                                          help_text='Total sleep hours (e.g. 7.5).')
    quality         = models.CharField(max_length=10, choices=SleepQuality.choices,
                                       default=SleepQuality.FAIR)
    interruptions   = models.PositiveSmallIntegerField(default=0)
    note            = models.TextField(blank=True)
    created_at      = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-sleep_date']
        unique_together = ('patient', 'sleep_date')
        indexes = [models.Index(fields=['patient', '-sleep_date'])]

    def __str__(self):
        return f'{self.patient} sleep {self.sleep_date}: {self.duration_hours}h ({self.quality})'


# ── Daily Check-in ────────────────────────────────────────────────────────────

class DailyCheckin(models.Model):
    """
    Aggregate daily record. Automatically created/updated when
    a MoodEntry or SleepEntry is saved for the same date.
    """
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient     = models.ForeignKey(
        'accounts.PatientProfile', on_delete=models.CASCADE,
        related_name='daily_checkins',
    )
    date        = models.DateField()
    mood_score  = models.PositiveSmallIntegerField(null=True, blank=True)
    mood_label  = models.CharField(max_length=15, choices=MoodLabel.choices, blank=True)
    sleep_hours = models.DecimalField(max_digits=4, decimal_places=1, null=True, blank=True)
    sleep_quality = models.CharField(max_length=10, choices=SleepQuality.choices, blank=True)
    # Program progress: activities completed this day
    activities_completed = models.PositiveSmallIntegerField(default=0)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('patient', 'date')
        ordering = ['-date']

    def __str__(self):
        return f'{self.patient} check-in {self.date}'
