from celery import shared_task
from django.utils import timezone
from datetime import timedelta
import logging

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def dispatch_notification(self, notification_id: str):
    """
    Send a Notification record via its designated channel.
    Retries up to 3 times with 60s delay on failure.
    """
    from .models import Notification
    from .service import send_push, send_email

    try:
        notif = Notification.objects.select_related('user').get(pk=notification_id)
    except Notification.DoesNotExist:
        return

    if notif.status not in (Notification.Status.PENDING,):
        return

    try:
        success = False

        if notif.channel == Notification.Channel.PUSH:
            success = send_push(notif.user, notif.title, notif.body, notif.data)

        elif notif.channel == Notification.Channel.EMAIL:
            success = send_email(notif.user, notif.title, notif.body)

        elif notif.channel == Notification.Channel.IN_APP:
            # IN_APP is already stored in DB — just mark sent
            success = True

        if success:
            notif.status  = Notification.Status.SENT
            notif.sent_at = timezone.now()
        else:
            raise RuntimeError('Dispatch returned False')

    except Exception as exc:
        notif.error = str(exc)
        notif.save(update_fields=['error'])
        raise self.retry(exc=exc)

    notif.save(update_fields=['status', 'sent_at'])


@shared_task
def mark_stale_notifications_failed():
    """
    Daily cleanup. Mark PENDING notifications older than 24h as FAILED.
    """
    from .models import Notification

    cutoff = timezone.now() - timedelta(hours=24)
    count = Notification.objects.filter(
        status=Notification.Status.PENDING,
        created_at__lt=cutoff,
    ).update(status=Notification.Status.FAILED)

    if count:
        logger.warning('mark_stale_notifications_failed: marked %d as FAILED', count)
    return count
