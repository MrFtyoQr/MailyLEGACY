"""
Public API for the audit module.

Usage:
    from apps.audit.logger import audit

    # From a DRF view (has request.user):
    audit(
        request   = request,
        action    = AuditAction.UPDATE,
        resource_type = ResourceType.MEDICATION,
        resource_id   = str(med.id),
        patient       = med.patient,
        changed_fields = ['dose', 'frequency'],
    )

    # From a Celery task (no request):
    audit(
        actor     = patient.user,
        action    = AuditAction.INSIGHT_GENERATED,
        resource_type = ResourceType.INSIGHT,
        resource_id   = str(insight.id),
        patient   = patient,
        note      = 'Celery task generate_patient_insight',
    )
"""
import logging
from django.db import transaction

from .models import AuditLog, AuditAction, ResourceType  # noqa: F401 — re-export for convenience

_log = logging.getLogger(__name__)


def audit(
    *,
    request=None,
    actor=None,
    actor_role: str = '',
    actor_email: str = '',
    action: str,
    resource_type: str = ResourceType.OTHER,
    resource_id: str = '',
    patient=None,
    changed_fields: list | None = None,
    note: str = '',
    http_status: int | None = None,
) -> AuditLog | None:
    """
    Create an immutable AuditLog entry.

    Pass either `request` (preferred from views) or `actor` (from tasks/signals).
    All failures are caught and logged — audit logging must never break the
    main code path.

    Returns the created AuditLog instance, or None on failure.
    """
    try:
        resolved_actor = actor
        resolved_role  = actor_role
        resolved_email = actor_email
        ip             = None
        ua             = ''
        endpoint       = ''

        if request is not None:
            if hasattr(request, 'user') and request.user and request.user.is_authenticated:
                resolved_actor = request.user
                resolved_role  = resolved_role or getattr(request.user, 'role', '')
                resolved_email = resolved_email or getattr(request.user, 'email', '')
            ip       = _get_ip(request)
            ua       = request.META.get('HTTP_USER_AGENT', '')[:512]
            endpoint = f'{request.method} {request.path}'[:255]

        elif resolved_actor is not None:
            resolved_role  = resolved_role  or getattr(resolved_actor, 'role', '')
            resolved_email = resolved_email or getattr(resolved_actor, 'email', '')

        entry = AuditLog(
            actor          = resolved_actor,
            actor_role     = resolved_role[:20],
            actor_email    = resolved_email[:254],
            action         = action,
            resource_type  = resource_type,
            resource_id    = str(resource_id)[:64],
            patient        = patient,
            ip_address     = ip,
            user_agent     = ua,
            endpoint       = endpoint,
            http_status    = http_status,
            changed_fields = changed_fields or [],
            note           = note[:500] if note else '',
        )
        # Use on_commit so the log write doesn't block the request transaction
        transaction.on_commit(lambda e=entry: e.save())
        return entry

    except Exception as exc:
        _log.error('audit() failed — %s', exc, exc_info=True)
        return None


def _get_ip(request) -> str | None:
    """Extract the real client IP, honoring X-Forwarded-For."""
    xff = request.META.get('HTTP_X_FORWARDED_FOR', '')
    if xff:
        return xff.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR') or None
