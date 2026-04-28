from celery import shared_task
from django.utils import timezone
from datetime import timedelta
import logging

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_appointment_reminder(self, appt_id: str, hours_before: int):
    """Send push/email reminder to patient and doctor before the appointment."""
    from .models import Appointment

    try:
        appt = Appointment.objects.select_related(
            'patient__user', 'doctor__user'
        ).get(pk=appt_id)
    except Appointment.DoesNotExist:
        return

    if appt.status not in (Appointment.Status.PENDING, Appointment.Status.CONFIRMED):
        return

    code = 'APPOINTMENT_REMINDER_24H' if hours_before == 24 else 'APPOINTMENT_REMINDER_1H'
    context = {
        'doctor_name': f'{appt.doctor.first_name} {appt.doctor.last_name}',
        'date':        appt.scheduled_at.strftime('%d/%m/%Y'),
        'time':        appt.scheduled_at.strftime('%H:%M'),
    }
    from apps.notifications.service import notify
    notify(appt.patient.user, code, context, channel='PUSH',
           data={'screen': 'appointment', 'id': str(appt.pk)})
    notify(appt.doctor.user, code, context, channel='PUSH',
           data={'screen': 'appointment', 'id': str(appt.pk)})

    if hours_before == 24:
        appt.reminder_24h_sent = True
        appt.save(update_fields=['reminder_24h_sent'])
    elif hours_before == 1:
        appt.reminder_1h_sent = True
        appt.save(update_fields=['reminder_1h_sent'])


@shared_task
def check_missed_appointments():
    """
    Runs every hour. Marks CONFIRMED/PENDING appointments as NO_SHOW
    if they ended more than 30 minutes ago and were never completed or cancelled.
    """
    from .models import Appointment

    cutoff = timezone.now() - timedelta(minutes=30)
    missed = Appointment.objects.filter(
        status__in=[Appointment.Status.PENDING, Appointment.Status.CONFIRMED],
        scheduled_at__lt=cutoff,
    )
    count = missed.update(status=Appointment.Status.NO_SHOW)
    if count:
        logger.warning('Marked %d appointments as NO_SHOW (cutoff=%s)', count, cutoff)
    return count
