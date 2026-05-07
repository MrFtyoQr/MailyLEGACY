"""
InputSanitizationMiddleware

Strips HTML tags and scripts from request JSON body and multipart text fields
before they reach views. Uses bleach for HTML stripping.

Excluded paths (webhooks with cryptographic signatures must not be modified):
  - /api/v1/payments/webhook/   (Stripe — raw body is signed)
  - /api/v1/auth/webhook/       (Clerk — raw body is signed via Svix)

Max field length: 10,000 characters. Longer values are truncated with a warning.
"""
import json
import logging
import re

logger = logging.getLogger(__name__)

_EXCLUDED_PATHS = frozenset([
    '/api/v1/payments/webhook/',
    '/api/v1/auth/webhook/',
])

MAX_FIELD_LENGTH = 10_000

# Regex fallback when bleach is not installed
_HTML_TAG_RE = re.compile(r'<[^>]+>')
# Null bytes
_NULL_BYTE_RE = re.compile(r'\x00')


def _strip_html(value: str) -> str:
    """Remove HTML tags via bleach (preferred) or regex fallback."""
    try:
        import bleach
        value = bleach.clean(value, tags=[], attributes={}, strip=True)
    except ImportError:
        value = _HTML_TAG_RE.sub('', value)
    return _NULL_BYTE_RE.sub('', value)


def _sanitize_value(value: str) -> str:
    value = _strip_html(value)
    if len(value) > MAX_FIELD_LENGTH:
        logger.warning(
            'InputSanitizationMiddleware: field truncated %d→%d chars',
            len(value), MAX_FIELD_LENGTH,
        )
        value = value[:MAX_FIELD_LENGTH]
    return value


def _walk_dict(data: dict) -> dict:
    return {k: _walk(v) for k, v in data.items()}


def _walk_list(data: list) -> list:
    return [_walk(item) for item in data]


def _walk(value):
    if isinstance(value, str):
        return _sanitize_value(value)
    if isinstance(value, dict):
        return _walk_dict(value)
    if isinstance(value, list):
        return _walk_list(value)
    return value


class InputSanitizationMiddleware:
    """
    Sanitizes JSON body and multipart text fields.

    - JSON: parses body → sanitizes → patches request._full_data and request._body
      so DRF reads clean data.
    - Multipart: sanitizes request.POST string values in-place.
    - Webhooks in _EXCLUDED_PATHS are skipped entirely.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if not any(request.path.startswith(p) for p in _EXCLUDED_PATHS):
            content_type = request.content_type or ''
            if 'application/json' in content_type and request.body:
                self._sanitize_json(request)
            elif 'multipart/form-data' in content_type:
                self._sanitize_multipart(request)

        return self.get_response(request)

    @staticmethod
    def _sanitize_json(request):
        try:
            raw = request.body  # force read
            data = json.loads(raw)
        except (json.JSONDecodeError, UnicodeDecodeError):
            return  # Let DRF return its own parse error

        if isinstance(data, dict):
            clean = _walk_dict(data)
        elif isinstance(data, list):
            clean = _walk_list(data)
        else:
            return

        # Patch DRF's cached data + raw body
        request._full_data = clean
        try:
            request._body = json.dumps(clean, ensure_ascii=False).encode('utf-8')
        except Exception:
            pass

    @staticmethod
    def _sanitize_multipart(request):
        try:
            mutable = request.POST.copy()
            for key in list(mutable.keys()):
                val = mutable.get(key)
                if isinstance(val, str):
                    mutable[key] = _sanitize_value(val)
            request.POST = mutable
        except Exception as exc:
            logger.warning('InputSanitizationMiddleware multipart error: %s', exc)
