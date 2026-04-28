"""
AuditMiddleware — automatically logs every mutating API request (POST/PUT/PATCH/DELETE)
plus any response with 4xx/5xx status.

Non-mutating GETs are NOT logged by default to avoid log bloat.
Sensitive endpoints (e.g., /api/v1/auth/webhook/) are excluded.

To log a specific GET (e.g., viewing a patient record), call audit() explicitly
inside the view instead of relying on this middleware.
"""
import threading
import logging

_local  = threading.local()
_logger = logging.getLogger(__name__)

EXCLUDED_PATHS = {
    '/api/v1/payments/webhook/',
    '/api/v1/auth/webhook/',
    '/admin/',
    '/health/',
    '/static/',
}

MUTATING_METHODS = {'POST', 'PUT', 'PATCH', 'DELETE'}


class AuditMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        # Only log mutating requests or errors
        should_log = (
            request.method in MUTATING_METHODS
            or (response.status_code >= 400)
        )

        if should_log and not any(request.path.startswith(p) for p in EXCLUDED_PATHS):
            self._log(request, response)

        return response

    def _log(self, request, response):
        try:
            from .logger import audit, AuditAction, ResourceType
            from .models import AuditAction as AA

            action = _method_to_action(request.method, response.status_code)
            if action is None:
                return

            audit(
                request     = request,
                action      = action,
                resource_type = _path_to_resource(request.path),
                resource_id = '',          # views can override via explicit audit() calls
                http_status = response.status_code,
                note        = 'auto:middleware',
            )
        except Exception as exc:
            _logger.debug('AuditMiddleware._log failed: %s', exc)


def _method_to_action(method: str, status_code: int) -> str | None:
    from .models import AuditAction as AA
    if status_code == 403:
        return AA.ACCESS_DENIED
    if method == 'POST':
        return AA.CREATE
    if method in ('PUT', 'PATCH'):
        return AA.UPDATE
    if method == 'DELETE':
        return AA.DELETE
    return None


def _path_to_resource(path: str) -> str:
    from .models import ResourceType as RT
    mapping = {
        '/medications':    RT.MEDICATION,
        '/vitals':         RT.VITAL_SIGN,
        '/labs':           RT.LAB_RESULT,
        '/appointments':   RT.APPOINTMENT,
        '/documents':      RT.DOCUMENT,
        '/chat':           RT.CHAT,
        '/payments':       RT.SUBSCRIPTION,
        '/analytics':      RT.INSIGHT,
        '/auth':           RT.USER,
    }
    for segment, resource in mapping.items():
        if segment in path:
            return resource
    return 'OTHER'
