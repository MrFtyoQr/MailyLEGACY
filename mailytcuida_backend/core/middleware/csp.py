"""
ContentSecurityPolicyMiddleware

Adds Content-Security-Policy headers to all responses.
- /admin/ routes → permissive policy (Django admin needs inline scripts/styles)
- All other routes (API JSON) → restrictive policy (default-src 'none')

Does not override if CSP header is already set by the view.
"""

# Django admin requires inline scripts and styles
_ADMIN_CSP = (
    "default-src 'self'; "
    "script-src 'self' 'unsafe-inline'; "
    "style-src 'self' 'unsafe-inline'; "
    "img-src 'self' data:; "
    "font-src 'self'; "
    "frame-ancestors 'none'; "
    "form-action 'self'; "
    "base-uri 'self';"
)

# Pure JSON API — no resources needed
_API_CSP = "default-src 'none';"


class ContentSecurityPolicyMiddleware:

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        response = self.get_response(request)

        # Don't overwrite if already set
        if 'Content-Security-Policy' in response:
            return response

        if request.path.startswith('/admin/'):
            response['Content-Security-Policy'] = _ADMIN_CSP
            response['Referrer-Policy'] = 'strict-origin-when-cross-origin'
            response['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=()'
        else:
            response['Content-Security-Policy'] = _API_CSP

        return response
