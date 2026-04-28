"""
Nutrition — meal plans and food diary.

Flow:
  ADMIN / nutritionist creates NutritionPlan with MealSlots.
  Patient receives NutritionPlanAssignment.
  Patient logs FoodEntry (diary) per meal slot or ad-hoc.
  DailyNutritionSummary is computed (via Celery task) each midnight.

Macro units: kcal (energy), grams (protein/carbs/fat/fiber), mg (sodium).
"""
import uuid
from django.db import models


class MealType(models.TextChoices):
    BREAKFAST  = 'BREAKFAST',  'Desayuno'
    MID_MORNING = 'MID_MORNING', 'Media mañana'
    LUNCH      = 'LUNCH',      'Comida'
    AFTERNOON  = 'AFTERNOON',  'Merienda'
    DINNER     = 'DINNER',     'Cena'
    SNACK      = 'SNACK',      'Colación'


class NutritionGoal(models.TextChoices):
    WEIGHT_LOSS   = 'WEIGHT_LOSS',   'Pérdida de peso'
    WEIGHT_GAIN   = 'WEIGHT_GAIN',   'Aumento de peso'
    MAINTENANCE   = 'MAINTENANCE',   'Mantenimiento'
    MUSCLE_GAIN   = 'MUSCLE_GAIN',   'Ganancia muscular'
    DIABETES_CTRL = 'DIABETES_CTRL', 'Control de diabetes'
    HEART_HEALTH  = 'HEART_HEALTH',  'Salud cardiovascular'
    CUSTOM        = 'CUSTOM',        'Personalizado'


# ── Nutrition Plan (template) ─────────────────────────────────────────────────

class NutritionPlan(models.Model):
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title       = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    goal        = models.CharField(max_length=20, choices=NutritionGoal.choices,
                                   default=NutritionGoal.MAINTENANCE)
    # Daily macro targets
    target_kcal    = models.PositiveSmallIntegerField(null=True, blank=True)
    target_protein_g = models.DecimalField(max_digits=6, decimal_places=1, null=True, blank=True)
    target_carbs_g   = models.DecimalField(max_digits=6, decimal_places=1, null=True, blank=True)
    target_fat_g     = models.DecimalField(max_digits=6, decimal_places=1, null=True, blank=True)
    target_fiber_g   = models.DecimalField(max_digits=6, decimal_places=1, null=True, blank=True)
    target_sodium_mg = models.PositiveSmallIntegerField(null=True, blank=True)

    duration_days = models.PositiveSmallIntegerField(default=30)
    created_by    = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='created_nutrition_plans',
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.title} ({self.goal})'


class MealSlot(models.Model):
    """
    A recommended meal within a plan (e.g. 'Monday Breakfast').
    Not tied to a specific date — used as a template guideline.
    """
    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    plan         = models.ForeignKey(NutritionPlan, on_delete=models.CASCADE, related_name='meal_slots')
    meal_type    = models.CharField(max_length=15, choices=MealType.choices)
    day_number   = models.PositiveSmallIntegerField(
        default=1,
        help_text='Day within the plan cycle (1 = Monday or Day 1).',
    )
    name         = models.CharField(max_length=200, help_text='e.g. "Avena con frutas"')
    description  = models.TextField(blank=True)
    # Macros for this slot
    kcal       = models.PositiveSmallIntegerField(null=True, blank=True)
    protein_g  = models.DecimalField(max_digits=6, decimal_places=1, null=True, blank=True)
    carbs_g    = models.DecimalField(max_digits=6, decimal_places=1, null=True, blank=True)
    fat_g      = models.DecimalField(max_digits=6, decimal_places=1, null=True, blank=True)
    fiber_g    = models.DecimalField(max_digits=6, decimal_places=1, null=True, blank=True)

    class Meta:
        ordering = ['day_number', 'meal_type']

    def __str__(self):
        return f'[{self.plan.title}] Day {self.day_number} {self.meal_type}: {self.name}'


# ── Assignment ────────────────────────────────────────────────────────────────

class NutritionPlanAssignment(models.Model):
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    plan        = models.ForeignKey(NutritionPlan, on_delete=models.CASCADE,
                                    related_name='assignments')
    patient     = models.ForeignKey(
        'accounts.PatientProfile', on_delete=models.CASCADE,
        related_name='nutrition_assignments',
    )
    assigned_by = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL, null=True, blank=True,
        related_name='nutrition_assignments_sent',
    )
    start_date  = models.DateField()
    end_date    = models.DateField(null=True, blank=True)
    is_active   = models.BooleanField(default=True)
    notes       = models.TextField(blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.plan.title} → {self.patient} (desde {self.start_date})'


# ── Food Diary ────────────────────────────────────────────────────────────────

class FoodEntry(models.Model):
    """
    Single food item logged by the patient.
    Can be linked to a MealSlot (planned) or free-form.
    """
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient    = models.ForeignKey(
        'accounts.PatientProfile', on_delete=models.CASCADE,
        related_name='food_entries',
    )
    logged_at  = models.DateTimeField()
    meal_type  = models.CharField(max_length=15, choices=MealType.choices)
    # Optional link to the plan slot
    meal_slot  = models.ForeignKey(
        MealSlot, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='food_entries',
    )
    food_name  = models.CharField(max_length=255)
    quantity_g = models.DecimalField(
        max_digits=7, decimal_places=1,
        help_text='Quantity in grams (or ml for liquids).',
    )
    # Macros per entry (computed from quantity + food data)
    kcal       = models.PositiveSmallIntegerField(null=True, blank=True)
    protein_g  = models.DecimalField(max_digits=6, decimal_places=1, null=True, blank=True)
    carbs_g    = models.DecimalField(max_digits=6, decimal_places=1, null=True, blank=True)
    fat_g      = models.DecimalField(max_digits=6, decimal_places=1, null=True, blank=True)
    fiber_g    = models.DecimalField(max_digits=6, decimal_places=1, null=True, blank=True)
    sodium_mg  = models.PositiveSmallIntegerField(null=True, blank=True)
    # Free-text note (e.g. "con leche descremada")
    note       = models.CharField(max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-logged_at']
        indexes = [
            models.Index(fields=['patient', '-logged_at']),
        ]

    def __str__(self):
        return f'{self.food_name} ({self.quantity_g}g) — {self.patient}'


# ── Daily Summary ─────────────────────────────────────────────────────────────

class DailyNutritionSummary(models.Model):
    """
    Computed aggregate of FoodEntry per patient per calendar day.
    Regenerated by a nightly Celery task.
    """
    id             = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient        = models.ForeignKey(
        'accounts.PatientProfile', on_delete=models.CASCADE,
        related_name='daily_nutrition_summaries',
    )
    date           = models.DateField()
    total_kcal     = models.PositiveSmallIntegerField(default=0)
    total_protein_g = models.DecimalField(max_digits=7, decimal_places=1, default=0)
    total_carbs_g   = models.DecimalField(max_digits=7, decimal_places=1, default=0)
    total_fat_g     = models.DecimalField(max_digits=7, decimal_places=1, default=0)
    total_fiber_g   = models.DecimalField(max_digits=7, decimal_places=1, default=0)
    total_sodium_mg = models.PositiveSmallIntegerField(default=0)
    entry_count     = models.PositiveSmallIntegerField(default=0)
    # Adherence: did this day match the assigned plan targets?
    plan_assignment = models.ForeignKey(
        NutritionPlanAssignment, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='daily_summaries',
    )
    kcal_target     = models.PositiveSmallIntegerField(null=True, blank=True)
    kcal_pct        = models.DecimalField(
        max_digits=5, decimal_places=1, null=True, blank=True,
        help_text='total_kcal / kcal_target * 100',
    )
    computed_at    = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('patient', 'date')
        ordering = ['-date']

    def __str__(self):
        return f'{self.patient} — {self.date}: {self.total_kcal} kcal'
