"""
Celery tasks for audit log maintenance.

  purge_old_audit_logs  — scheduled monthly; removes entries older than
                          AUDIT_RETENTION_DAYS (default: 730 days / 2 years).
                          Medical regulations in Mexico (NOM-024) require
                          at minimum 5 years for clinical records; adjust
                          AUDIT_RETENTION_DAYS accordingly in production.
"""
import logging
from celery import shared_task
from django.conf import settings

logger = logging.getLogger(__name__)


@shared_task
def purge_old_audit_logs():
    """
    Delete audit entries older than AUDIT_RETENTION_DAYS.
    Default: 730 days (2 years).  Override in settings for compliance.
    """
    from datetime import timedelta
    from django.utils import timezone
    from .models import AuditLog

    retention_days = getattr(settings, 'AUDIT_RETENTION_DAYS', 730)
    cutoff = timezone.now() - timedelta(days=retention_days)

    # Direct queryset delete bypasses the immutability guard on the model
    deleted, _ = AuditLog.objects.filter(created_at__lt=cutoff)._raw_delete(
        AuditLog.objects.filter(created_at__lt=cutoff).db
    )
    logger.info('Purged %d audit log entries older than %d days', deleted, retention_days)
    return deleted
