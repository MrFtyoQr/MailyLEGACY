"""
Celery tasks — Nutrition.

compute_daily_nutrition_summary: runs nightly at 23:59 for a given date,
aggregates all FoodEntry records and updates DailyNutritionSummary.
"""
import logging
from datetime import date, timedelta
from decimal import Decimal

from celery import shared_task
from django.db.models import Sum

_log = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def compute_daily_nutrition_summary(self, target_date_str: str | None = None):
    """
    Aggregate food entries for all patients on `target_date_str` (YYYY-MM-DD).
    Defaults to yesterday if not provided.
    """
    from apps.accounts.models import PatientProfile
    from .models import DailyNutritionSummary, FoodEntry, NutritionPlanAssignment

    try:
        if target_date_str:
            target_date = date.fromisoformat(target_date_str)
        else:
            target_date = date.today() - timedelta(days=1)

        # Patients who logged food on this day
        patient_ids = FoodEntry.objects.filter(
            logged_at__date=target_date
        ).values_list('patient_id', flat=True).distinct()

        updated = 0
        for patient_id in patient_ids:
            entries = FoodEntry.objects.filter(
                patient_id=patient_id,
                logged_at__date=target_date,
            )
            agg = entries.aggregate(
                total_kcal=Sum('kcal'),
                total_protein_g=Sum('protein_g'),
                total_carbs_g=Sum('carbs_g'),
                total_fat_g=Sum('fat_g'),
                total_fiber_g=Sum('fiber_g'),
                total_sodium_mg=Sum('sodium_mg'),
            )

            # Find active plan assignment for this day
            assignment = NutritionPlanAssignment.objects.filter(
                patient_id=patient_id,
                is_active=True,
                start_date__lte=target_date,
            ).filter(
                end_date__gte=target_date
            ).first() or NutritionPlanAssignment.objects.filter(
                patient_id=patient_id,
                is_active=True,
                start_date__lte=target_date,
                end_date__isnull=True,
            ).first()

            kcal_target = assignment.plan.target_kcal if assignment else None
            total_kcal = agg['total_kcal'] or 0
            kcal_pct = None
            if kcal_target and kcal_target > 0:
                kcal_pct = Decimal(str(round(total_kcal / kcal_target * 100, 1)))

            DailyNutritionSummary.objects.update_or_create(
                patient_id=patient_id,
                date=target_date,
                defaults={
                    'total_kcal': total_kcal,
                    'total_protein_g': agg['total_protein_g'] or Decimal('0'),
                    'total_carbs_g': agg['total_carbs_g'] or Decimal('0'),
                    'total_fat_g': agg['total_fat_g'] or Decimal('0'),
                    'total_fiber_g': agg['total_fiber_g'] or Decimal('0'),
                    'total_sodium_mg': agg['total_sodium_mg'] or 0,
                    'entry_count': entries.count(),
                    'plan_assignment': assignment,
                    'kcal_target': kcal_target,
                    'kcal_pct': kcal_pct,
                },
            )
            updated += 1

        _log.info('compute_daily_nutrition_summary: %s patients updated for %s', updated, target_date)
        return {'date': str(target_date), 'patients_updated': updated}

    except Exception as exc:
        _log.error('compute_daily_nutrition_summary failed: %s', exc, exc_info=True)
        raise self.retry(exc=exc)
