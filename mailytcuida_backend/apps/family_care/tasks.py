from celery import shared_task
from django.utils import timezone
from datetime import timedelta
import logging

logger = logging.getLogger(__name__)


@shared_task
def check_vital_overdue():
    """
    Corre cada hora via celery-beat (registrar en Django Admin → Periodic Tasks).
    Para cada VitalMonitorConfig activo, verifica si el paciente ha registrado
    su signo vital en el intervalo esperado. Si no, crea CareAlert y notifica.
    """
    from .models import VitalMonitorConfig, CareAlert
    from apps.notifications.service import notify

    now = timezone.now()
    configs = VitalMonitorConfig.objects.filter(
        is_active=True,
        care_link__status='ACTIVE',
    ).select_related('care_link__caregiver', 'care_link__patient')

    for config in configs:
        threshold = now - timedelta(hours=config.reminder_frequency_hours)
        last_reading = config.last_patient_reading_at

        if last_reading is not None and last_reading >= threshold:
            continue

        # Evitar alertas duplicadas abiertas del mismo tipo+vital
        already_open = CareAlert.objects.filter(
            care_link=config.care_link,
            alert_type=CareAlert.AlertType.VITAL_OVERDUE,
            vital_type=config.vital_type,
            status=CareAlert.Status.OPEN,
        ).exists()
        if already_open:
            continue

        CareAlert.objects.create(
            care_link=config.care_link,
            alert_type=CareAlert.AlertType.VITAL_OVERDUE,
            vital_type=config.vital_type,
            severity=CareAlert.Severity.MEDIUM,
        )

        notify(
            user=config.care_link.patient,
            code='FAMILY_VITAL_REMINDER',
            context={
                'hours': config.reminder_frequency_hours,
                'vital_type': config.vital_type,
            },
        )

        config.last_reminder_sent_at = now
        config.save(update_fields=['last_reminder_sent_at'])

    return f'check_vital_overdue: revisados {configs.count()} configs'


@shared_task(bind=True, max_retries=3, default_retry_delay=30)
def notify_caregiver_vital_abnormal(self, care_link_id: str, vital_sign_id: str, severity: str):
    """Notifica al cuidador cuando el paciente registra un vital fuera de rango."""
    try:
        from .models import FamilyCareLink, CareAlert
        from apps.vitals.models import VitalSign
        from apps.notifications.service import notify

        link = FamilyCareLink.objects.get(pk=care_link_id)
        vital = VitalSign.objects.get(pk=vital_sign_id)

        CareAlert.objects.get_or_create(
            care_link=link,
            alert_type=CareAlert.AlertType.VITAL_ABNORMAL,
            vital_sign=vital,
            status=CareAlert.Status.OPEN,
            defaults={'severity': severity, 'vital_type': vital.vital_type},
        )

        notify(
            user=link.caregiver,
            code='VITAL_ABNORMAL',
            context={
                'vital_type': vital.vital_type,
                'value': vital.value,
                'unit': vital.unit,
            },
        )
    except Exception as exc:
        raise self.retry(exc=exc)
