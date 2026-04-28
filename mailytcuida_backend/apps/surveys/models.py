"""
Surveys — health questionnaires and symptom tracking.

A Survey is a template created by ADMIN or a doctor.
Patients receive SurveyAssignment and submit SurveyResponse.

Question types: TEXT, NUMBER, SCALE (1-10), SINGLE_CHOICE, MULTI_CHOICE, BOOLEAN
"""
import uuid
from django.db import models


class SurveyCategory(models.TextChoices):
    SYMPTOM_TRACKING  = 'SYMPTOM_TRACKING',  'Seguimiento de síntomas'
    MENTAL_HEALTH     = 'MENTAL_HEALTH',     'Salud mental'
    LIFESTYLE         = 'LIFESTYLE',         'Estilo de vida'
    MEDICATION_EFFECT = 'MEDICATION_EFFECT', 'Efecto de medicamento'
    POST_APPOINTMENT  = 'POST_APPOINTMENT',  'Post-consulta'
    ONBOARDING        = 'ONBOARDING',        'Bienvenida'
    CUSTOM            = 'CUSTOM',            'Personalizado'


class QuestionType(models.TextChoices):
    TEXT          = 'TEXT',          'Respuesta libre'
    NUMBER        = 'NUMBER',        'Número'
    SCALE         = 'SCALE',         'Escala 1-10'
    SINGLE_CHOICE = 'SINGLE_CHOICE', 'Opción única'
    MULTI_CHOICE  = 'MULTI_CHOICE',  'Opción múltiple'
    BOOLEAN       = 'BOOLEAN',       'Sí / No'


class Survey(models.Model):
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title       = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    category    = models.CharField(max_length=20, choices=SurveyCategory.choices,
                                   default=SurveyCategory.CUSTOM)
    # Creator: ADMIN or doctor
    created_by  = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='created_surveys',
    )
    estimated_minutes = models.PositiveSmallIntegerField(default=5)
    is_active   = models.BooleanField(default=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return self.title


class SurveyQuestion(models.Model):
    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    survey       = models.ForeignKey(Survey, on_delete=models.CASCADE, related_name='questions')
    order        = models.PositiveSmallIntegerField(default=0)
    text         = models.TextField()
    question_type = models.CharField(max_length=15, choices=QuestionType.choices)
    # For SINGLE_CHOICE / MULTI_CHOICE: list of option strings
    options      = models.JSONField(default=list, blank=True)
    is_required  = models.BooleanField(default=True)
    # For SCALE: min/max labels
    scale_min_label = models.CharField(max_length=50, blank=True)
    scale_max_label = models.CharField(max_length=50, blank=True)

    class Meta:
        ordering = ['order']

    def __str__(self):
        return f'[{self.survey.title}] Q{self.order}: {self.text[:60]}'


class SurveyAssignment(models.Model):
    """A survey sent to a specific patient by a doctor or automated rule."""
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    survey      = models.ForeignKey(Survey, on_delete=models.CASCADE, related_name='assignments')
    patient     = models.ForeignKey(
        'accounts.PatientProfile', on_delete=models.CASCADE, related_name='survey_assignments'
    )
    assigned_by = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='survey_assignments_sent',
    )
    due_date    = models.DateField(null=True, blank=True)
    completed   = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.survey.title} → {self.patient} (done={self.completed})'


class SurveyResponse(models.Model):
    """All answers for one assignment submission."""
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    assignment  = models.OneToOneField(
        SurveyAssignment, on_delete=models.CASCADE, related_name='response'
    )
    submitted_at = models.DateTimeField(auto_now_add=True)
    # Computed score for scored surveys (e.g. PHQ-9 mental health)
    score       = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    score_label = models.CharField(max_length=100, blank=True)

    def __str__(self):
        return f'Response to {self.assignment}'


class QuestionAnswer(models.Model):
    """One answer per question per response."""
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    response    = models.ForeignKey(SurveyResponse, on_delete=models.CASCADE, related_name='answers')
    question    = models.ForeignKey(SurveyQuestion, on_delete=models.CASCADE)
    # Stored as JSON to accommodate all question types uniformly
    value       = models.JSONField(help_text='String, number, bool, or list of strings')

    class Meta:
        unique_together = ('response', 'question')
