import uuid
from django.db import models


class AdherenceReport(models.Model):
    class Period(models.TextChoices):
        WEEKLY  = 'WEEKLY',  'Semanal'
        MONTHLY = 'MONTHLY', 'Mensual'

    id                   = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient              = models.ForeignKey(
        'accounts.PatientProfile', on_delete=models.CASCADE, related_name='adherence_reports'
    )
    period               = models.CharField(max_length=10, choices=Period.choices)
    period_start         = models.DateField(db_index=True)
    period_end           = models.DateField()
    total_doses          = models.PositiveIntegerField(default=0)
    taken_doses          = models.PositiveIntegerField(default=0)
    skipped_doses        = models.PositiveIntegerField(default=0)
    postponed_doses      = models.PositiveIntegerField(default=0)
    adherence_pct        = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    medications_tracked  = models.JSONField(default=list)  # [{name, taken, total, pct}]
    created_at           = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'analytics_adherence_report'
        ordering = ['-period_start']
        constraints = [
            models.UniqueConstraint(
                fields=['patient', 'period', 'period_start'],
                name='unique_adherence_report',
            )
        ]

    def __str__(self):
        return f'{self.patient} — {self.period} {self.period_start} ({self.adherence_pct}%)'


class HealthInsight(models.Model):
    class InsightType(models.TextChoices):
        MEDICATION_ADHERENCE = 'MEDICATION_ADHERENCE', 'Adherencia a medicamentos'
        VITAL_TREND          = 'VITAL_TREND',          'Tendencia de vitales'
        LAB_ANALYSIS         = 'LAB_ANALYSIS',         'Análisis de laboratorio'
        GENERAL_HEALTH       = 'GENERAL_HEALTH',       'Salud general'

    class AIProvider(models.TextChoices):
        OPENAI     = 'OPENAI',     'OpenAI'
        ANTHROPIC  = 'ANTHROPIC',  'Anthropic (Claude)'
        RULE_BASED = 'RULE_BASED', 'Reglas'

    id            = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient       = models.ForeignKey(
        'accounts.PatientProfile', on_delete=models.CASCADE, related_name='health_insights'
    )
    insight_type  = models.CharField(max_length=25, choices=InsightType.choices)
    provider      = models.CharField(max_length=15, choices=AIProvider.choices)
    model_used    = models.CharField(max_length=50, blank=True)  # e.g. 'gpt-4o', 'claude-sonnet-4-6'
    summary       = models.TextField()          # one-line headline
    detail        = models.TextField(blank=True)  # full explanation
    actions       = models.JSONField(default=list)  # [{action, priority}]
    context_hash  = models.CharField(max_length=64, blank=True)  # sha256 of input context
    created_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'analytics_health_insight'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['patient', 'insight_type', '-created_at']),
        ]

    def __str__(self):
        return f'[{self.insight_type}] {self.patient} — {self.summary[:60]}'
