from celery import shared_task
from datetime import date, timedelta
import logging

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=2, default_retry_delay=300)
def generate_patient_insight(self, patient_id: str, insight_type: str = 'GENERAL_HEALTH'):
    """Generate a single AI insight for a patient."""
    from apps.accounts.models import PatientProfile
    from .models import HealthInsight
    from .engine import build_health_context
    from .ai_service import get_insight

    try:
        patient = PatientProfile.objects.select_related('user__subscription__plan').get(pk=patient_id)
    except PatientProfile.DoesNotExist:
        return

    try:
        context = build_health_context(patient)
        result  = get_insight(patient, insight_type, context)

        HealthInsight.objects.create(
            patient      = patient,
            insight_type = insight_type,
            provider     = result['provider'],
            model_used   = result.get('model_used', ''),
            summary      = result['summary'],
            detail       = result.get('detail', ''),
            actions      = result.get('actions', []),
            context_hash = result.get('context_hash', ''),
        )
        logger.info('Insight generated: patient=%s type=%s provider=%s',
                    patient_id, insight_type, result['provider'])
    except Exception as exc:
        logger.error('generate_patient_insight failed: %s', exc)
        raise self.retry(exc=exc)


@shared_task
def generate_weekly_adherence_report():
    """
    Every Monday. Computes the previous week's adherence snapshot for every
    patient that has at least one active medication.
    """
    from apps.accounts.models import PatientProfile
    from apps.medications.models import Medication, MedicationHistory
    from .models import AdherenceReport
    from .engine import calculate_adherence
    from django.db.models import Count

    today      = date.today()
    week_end   = today - timedelta(days=1)           # yesterday (Sunday)
    week_start = week_end - timedelta(days=6)        # previous Monday

    patient_ids = (
        Medication.objects
        .filter(is_active=True)
        .values_list('patient_id', flat=True)
        .distinct()
    )

    created = 0
    for patient_id in patient_ids:
        try:
            patient = PatientProfile.objects.get(pk=patient_id)
        except PatientProfile.DoesNotExist:
            continue

        stats = calculate_adherence(patient, days=7)

        report, is_new = AdherenceReport.objects.update_or_create(
            patient=patient,
            period='WEEKLY',
            period_start=week_start,
            defaults={
                'period_end':         week_end,
                'total_doses':        stats['total'],
                'taken_doses':        stats['taken'],
                'skipped_doses':      stats['skipped'],
                'postponed_doses':    stats['postponed'],
                'adherence_pct':      stats['adherence_pct'],
                'medications_tracked': stats['per_medication'],
            },
        )
        if is_new:
            created += 1

        # Trigger AI insight if adherence is concerning
        if stats['adherence_pct'] < 70 and stats['total'] > 0:
            generate_patient_insight.delay(str(patient_id), 'MEDICATION_ADHERENCE')

    logger.info('Weekly adherence reports: created=%d week=%s', created, week_start)
    return created


@shared_task
def generate_all_patient_insights():
    """
    Weekly. Generate GENERAL_HEALTH insight for every active patient with a
    paid plan (SILVER+). FREE patients get rule-based fallback only.
    """
    from apps.accounts.models import PatientProfile
    from apps.medications.models import Medication

    patient_ids = (
        Medication.objects
        .filter(is_active=True)
        .values_list('patient_id', flat=True)
        .distinct()
    )

    for patient_id in patient_ids:
        generate_patient_insight.delay(str(patient_id), 'GENERAL_HEALTH')

    logger.info('Queued general health insights for %d patients', len(patient_ids))
