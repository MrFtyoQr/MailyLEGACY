"""
Custom throttle classes — MailyT Cuida.

Usage in views:
    from core.throttles import WebhookThrottle, CheckoutThrottle, PhotoUploadThrottle

    class MyView(APIView):
        throttle_classes = [WebhookThrottle]

Rates are defined in settings.REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']:
    'webhook':      '5/min'
    'checkout':     '10/min'
    'photo_upload': '20/hour'
"""
from rest_framework.throttling import ScopedRateThrottle


class WebhookThrottle(ScopedRateThrottle):
    """5 requests/min per IP — for incoming webhook endpoints (Stripe, etc.)."""
    scope = 'webhook'

    def get_cache_key(self, request, view):
        # Webhooks don't have an authenticated user → throttle by IP.
        ident = self.get_ident(request)
        return self.cache_format % {'scope': self.scope, 'ident': ident}


class CheckoutThrottle(ScopedRateThrottle):
    """10 requests/min per user — for Stripe checkout and portal endpoints."""
    scope = 'checkout'

    def get_cache_key(self, request, view):
        if request.user and request.user.is_authenticated:
            ident = str(request.user.pk)
        else:
            ident = self.get_ident(request)
        return self.cache_format % {'scope': self.scope, 'ident': ident}


class PhotoUploadThrottle(ScopedRateThrottle):
    """20 uploads/hour per user — for profile photo upload endpoints."""
    scope = 'photo_upload'

    def get_cache_key(self, request, view):
        if request.user and request.user.is_authenticated:
            ident = str(request.user.pk)
        else:
            ident = self.get_ident(request)
        return self.cache_format % {'scope': self.scope, 'ident': ident}
