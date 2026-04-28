"""
Development-only authentication bypass.

When DEV_AUTH_BYPASS=True in .env AND DEBUG=True:
  - Send header:  X-Dev-User-Email: admin@mailyt.dev
  - The middleware will authenticate as that user (must exist in DB).

NEVER enable in production — checked with dual guard (DEBUG + env var).
"""
import os
import logging

from django.conf import settings
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

_log = logging.getLogger(__name__)


class DevBypassAuthentication(BaseAuthentication):
    """
    Simple header-based auth for local Postman testing.
    Only active when DEBUG=True AND DEV_AUTH_BYPASS env var is 'True'.
    """

    def _is_enabled(self):
        if not settings.DEBUG:
            return False
        return os.environ.get('DEV_AUTH_BYPASS', 'False').lower() == 'true'

    def authenticate(self, request):
        if not self._is_enabled():
            return None

        email = request.headers.get('X-Dev-User-Email')
        if not email:
            return None

        from apps.accounts.models import User
        try:
            user = User.objects.get(email=email, is_active=True)
            _log.debug('[DEV AUTH] Authenticated as %s (%s)', email, user.role)
            return (user, 'dev-bypass')
        except User.DoesNotExist:
            raise AuthenticationFailed(
                f'[DEV] No user with email "{email}". '
                'Run: docker compose exec web python manage.py seed_dev_data'
            )

    def authenticate_header(self, request):
        return 'X-Dev-User-Email'
