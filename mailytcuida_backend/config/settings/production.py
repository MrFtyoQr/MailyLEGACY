from .base import *  # noqa
import environ

_env = environ.Env()

DEBUG = False

# ── Hosts ─────────────────────────────────────────────────────────────────────
# Must be set in Sevalla env vars: ALLOWED_HOSTS=mailyt-cuidalegacy-iihlu.sevalla.app
# Fallback covers the Sevalla domain so health probes never get 400.
ALLOWED_HOSTS = _env.list('ALLOWED_HOSTS', default=[
    'mailyt-cuidalegacy-iihlu.sevalla.app',
    '.sevalla.app',
    'localhost',
    '127.0.0.1',
])

# ── Seguridad HTTP ────────────────────────────────────────────────────────────
SECURE_SSL_REDIRECT = True
# Kubernetes/Sevalla probes hit http://127.0.0.1:8000/health/ — exempt it from SSL redirect
SECURE_REDIRECT_EXEMPT = [r'^health/$']
SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_BROWSER_XSS_FILTER = True
SECURE_CONTENT_TYPE_NOSNIFF = True

# Sevalla pone el proxy delante — confiar en su header
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')

# ── Storage Cloudflare R2 (solo media — fotos, documentos) ───────────────────
DEFAULT_FILE_STORAGE   = 'storages.backends.s3boto3.S3Boto3Storage'
AWS_DEFAULT_ACL        = 'public-read'
AWS_QUERYSTRING_AUTH   = False

# Archivos estáticos (CSS/JS admin) — whitenoise sirve directamente desde /app/staticfiles/
# Usamos CompressedStaticFilesStorage (sin manifest) para evitar problemas de hashing
# con unfold y otros paquetes que referencian archivos con rutas relativas.
STATICFILES_STORAGE    = 'whitenoise.storage.CompressedStaticFilesStorage'
WHITENOISE_MANIFEST_STRICT = False

# ── Logging ───────────────────────────────────────────────────────────────────
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'simple': {'format': '[%(levelname)s] %(name)s: %(message)s'},
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'simple',
        },
    },
    'root': {
        'handlers': ['console'],
        'level': 'WARNING',
    },
    'loggers': {
        'django': {'handlers': ['console'], 'level': 'WARNING', 'propagate': False},
        'apps':   {'handlers': ['console'], 'level': 'INFO',    'propagate': False},
    },
}
