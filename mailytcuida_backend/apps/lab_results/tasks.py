from celery import shared_task
import logging

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def generate_lab_recommendations(self, result_id: str):
    """
    Generate rule-based recommendations for a LabResult when it is abnormal.
    Future: augment with LLM for GOLD/PLATINUM patients (M09 Analytics).
    """
    from .models import LabResult
    from .recommendations import create_recommendations_for_result

    try:
        result = LabResult.objects.select_related('patient').get(pk=result_id)
    except LabResult.DoesNotExist:
        return

    if result.status == LabResult.Status.UNKNOWN:
        return

    count = create_recommendations_for_result(result)
    if count:
        logger.info(
            'Recommendations generated: result=%s parameter=%s status=%s count=%d',
            result_id, result.parameter, result.status, count,
        )
