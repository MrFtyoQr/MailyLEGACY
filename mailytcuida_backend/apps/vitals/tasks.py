from celery import shared_task
from django.utils import timezone
import logging

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def check_abnormal_vitals(self, vital_id: str):
    """
    Check if a VitalSign reading is outside the patient's goal range.
    If so, log the alert and (future) dispatch notification to patient and doctor.
    """
    from .models import VitalSign, VitalGoal

    try:
        vital = VitalSign.objects.select_related('patient').get(pk=vital_id)
    except VitalSign.DoesNotExist:
        return

    goal = VitalGoal.objects.filter(
        patient=vital.patient,
        vital_type=vital.vital_type,
        is_active=True,
    ).first()

    if not goal:
        return  # no goal configured — nothing to check

    is_abnormal = False
    reasons = []

    if goal.min_value is not None and vital.value < goal.min_value:
        is_abnormal = True
        reasons.append(f'valor {vital.value} < mínimo {goal.min_value}')
    if goal.max_value is not None and vital.value > goal.max_value:
        is_abnormal = True
        reasons.append(f'valor {vital.value} > máximo {goal.max_value}')

    if vital.secondary_value is not None:
        if goal.min_secondary is not None and vital.secondary_value < goal.min_secondary:
            is_abnormal = True
            reasons.append(f'diastólica {vital.secondary_value} < mínimo {goal.min_secondary}')
        if goal.max_secondary is not None and vital.secondary_value > goal.max_secondary:
            is_abnormal = True
            reasons.append(f'diastólica {vital.secondary_value} > máximo {goal.max_secondary}')

    if is_abnormal:
        detail = '; '.join(reasons)
        logger.warning(
            'Abnormal vital: patient=%s type=%s %s',
            vital.patient_id, vital.vital_type, detail,
        )
        from apps.notifications.service import notify
        notify(
            user=vital.patient.user,
            code='VITAL_ABNORMAL',
            context={
                'vital_type': vital.get_vital_type_display(),
                'value':      str(vital.value),
                'unit':       vital.unit,
            },
            channel='PUSH',
            data={'screen': 'vitals', 'id': str(vital.pk)},
        )


@shared_task
def generate_vitals_summary():
    """
    Weekly task. Generates a statistical summary per patient per vital type
    for the past 7 days and logs it. Future: store in a summary table (M09 Analytics).
    """
    from .models import VitalSign
    from apps.accounts.models import PatientProfile
    from django.db.models import Min, Max, Avg, Count
    from datetime import timedelta

    since = timezone.now() - timedelta(days=7)
    patient_ids = (
        VitalSign.objects
        .filter(recorded_at__gte=since)
        .values_list('patient_id', flat=True)
        .distinct()
    )

    for patient_id in patient_ids:
        for vital_type, _ in VitalSign.VitalType.choices:
            agg = VitalSign.objects.filter(
                patient_id=patient_id,
                vital_type=vital_type,
                recorded_at__gte=since,
            ).aggregate(
                count=Count('id'),
                min_v=Min('value'),
                max_v=Max('value'),
                avg_v=Avg('value'),
            )
            if agg['count']:
                logger.info(
                    'Weekly summary: patient=%s type=%s count=%d min=%s max=%s avg=%s',
                    patient_id, vital_type,
                    agg['count'], agg['min_v'], agg['max_v'], agg['avg_v'],
                )
