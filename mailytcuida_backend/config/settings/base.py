import environ
import sentry_sdk
from pathlib import Path
from sentry_sdk.integrations.django import DjangoIntegration
from sentry_sdk.integrations.celery import CeleryIntegration

env = environ.Env()

BASE_DIR = Path(__file__).resolve().parent.parent.parent

environ.Env.read_env(BASE_DIR / '.env')

SECRET_KEY = env('SECRET_KEY')

DEBUG = env.bool('DEBUG', default=False)

ALLOWED_HOSTS = env.list('ALLOWED_HOSTS', default=[])

DJANGO_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
]

THIRD_PARTY_APPS = [
    'rest_framework',
    'corsheaders',
    'axes',
    'channels',
]

LOCAL_APPS = [
    'apps.accounts',
    'apps.medications',
    'apps.vitals',
    'apps.lab_results',
    'apps.appointments',
    'apps.notifications',
    'apps.chat',
    'apps.payments',
    'apps.analytics',
    'apps.documents',
    'apps.audit',
    'apps.prescriptions',
    'apps.specialists',
    'apps.gamification',
    'apps.partners',
    'apps.coupons',
    'apps.telemedicine',
    'apps.surveys',
    'apps.nutrition',
    'apps.wellness',
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'apps.accounts.middleware.clerk_auth.ClerkAuthMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'apps.audit.middleware.AuditMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'axes.middleware.AxesMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'
ASGI_APPLICATION = 'config.asgi.application'

DATABASES = {
    'default': env.db('DATABASE_URL')
}

CACHES = {
    'default': {
        'BACKEND': 'django_redis.cache.RedisCache',
        'LOCATION': env('REDIS_URL', default='redis://localhost:6379/0'),
        'OPTIONS': {'CLIENT_CLASS': 'django_redis.client.DefaultClient'},
    }
}

CHANNEL_LAYERS = {
    'default': {
        'BACKEND': 'channels_redis.core.RedisChannelLayer',
        'CONFIG': {'hosts': [env('REDIS_URL', default='redis://localhost:6379/0')]},
    }
}

AUTH_PASSWORD_VALIDATORS = [
    {'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator'},
    {'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator', 'OPTIONS': {'min_length': 8}},
    {'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator'},
    {'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator'},
]

LANGUAGE_CODE = 'es-mx'
TIME_ZONE = 'America/Mexico_City'
USE_I18N = True
USE_TZ = True

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

AUTH_USER_MODEL = 'accounts.User'

# ── Clerk ────────────────────────────────────────────────────────────────────
CLERK_SECRET_KEY = env('CLERK_SECRET_KEY')
CLERK_WEBHOOK_SECRET = env('CLERK_WEBHOOK_SECRET')
CLERK_JWKS_URL = env('CLERK_JWKS_URL', default='https://api.clerk.com/v1/jwks')

# ── REST Framework ────────────────────────────────────────────────────────────
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'apps.accounts.middleware.clerk_auth.ClerkJWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_PAGINATION_CLASS': 'core.pagination.StandardPagination',
    'PAGE_SIZE': 20,
    'EXCEPTION_HANDLER': 'core.exceptions.custom_exception_handler',
}

# ── CORS ──────────────────────────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS = env.list('CORS_ALLOWED_ORIGINS', default=[])
CORS_ALLOW_CREDENTIALS = True

# ── Rate limiting (django-axes) ───────────────────────────────────────────────
AXES_FAILURE_LIMIT = 5
AXES_COOLOFF_TIME = 0.25   # 15 minutos en horas
AXES_LOCKOUT_PARAMETERS = ['ip_address']
AXES_RESET_ON_SUCCESS = True
AUTHENTICATION_BACKENDS = [
    'axes.backends.AxesStandaloneBackend',
    'django.contrib.auth.backends.ModelBackend',
]

# ── Sentry ────────────────────────────────────────────────────────────────────
def _sanitize_medical_data(event, hint):
    """Elimina campos médicos sensibles antes de enviar a Sentry."""
    sensitive = {'allergies', 'chronic_conditions', 'blood_type', 'birth_date',
                 'emergency_contact_name', 'emergency_contact_phone', 'diagnosis',
                 'glucose_mgdl', 'heart_rate', 'systolic_bp', 'diastolic_bp'}
    if 'request' in event and 'data' in event.get('request', {}):
        for key in sensitive:
            event['request']['data'].pop(key, None)
    return event

sentry_sdk.init(
    dsn=env('SENTRY_DSN', default=''),
    integrations=[DjangoIntegration(), CeleryIntegration()],
    traces_sample_rate=0.2,
    profiles_sample_rate=0.1,
    send_default_pii=False,
    before_send=_sanitize_medical_data,
    environment=env('ENVIRONMENT', default='development'),
)

# ── Storage (S3 / Cloudflare R2) ─────────────────────────────────────────────
AWS_ACCESS_KEY_ID = env('AWS_ACCESS_KEY_ID', default='')
AWS_SECRET_ACCESS_KEY = env('AWS_SECRET_ACCESS_KEY', default='')
AWS_STORAGE_BUCKET_NAME = env('AWS_STORAGE_BUCKET_NAME', default='')
AWS_S3_ENDPOINT_URL = env('AWS_S3_ENDPOINT_URL', default='')  # Cloudflare R2

# ── Stripe ────────────────────────────────────────────────────────────────────
STRIPE_SECRET_KEY      = env('STRIPE_SECRET_KEY', default='')
STRIPE_WEBHOOK_SECRET  = env('STRIPE_WEBHOOK_SECRET', default='')
STRIPE_PUBLISHABLE_KEY = env('STRIPE_PUBLISHABLE_KEY', default='')

# ── Email / Notifications ─────────────────────────────────────────────────────
EMAIL_PROVIDER     = env('EMAIL_PROVIDER', default='django')  # 'sendgrid' | 'django'
SENDGRID_API_KEY   = env('SENDGRID_API_KEY', default='')
DEFAULT_FROM_EMAIL = env('DEFAULT_FROM_EMAIL', default='noreply@mailytcuida.com')
FCM_CREDENTIALS_JSON = env('FCM_CREDENTIALS_JSON', default='')  # JSON string of service account

# ── MailySoft integration ─────────────────────────────────────────────────────
MAILYSOFT_WEBHOOK_SECRET = env('MAILYSOFT_WEBHOOK_SECRET', default='')

# ── Audit log ─────────────────────────────────────────────────────────────────
AUDIT_RETENTION_DAYS = env.int('AUDIT_RETENTION_DAYS', default=730)  # 2 years default

# ── AI providers ──────────────────────────────────────────────────────────────
OPENAI_API_KEY    = env('OPENAI_API_KEY',    default='')
ANTHROPIC_API_KEY = env('ANTHROPIC_API_KEY', default='')

# ── Celery ────────────────────────────────────────────────────────────────────
_redis_url = env('REDIS_URL', default='redis://localhost:6379/0')
CELERY_BROKER_URL        = _redis_url
CELERY_RESULT_BACKEND    = _redis_url
CELERY_ACCEPT_CONTENT    = ['json']
CELERY_TASK_SERIALIZER   = 'json'
CELERY_RESULT_SERIALIZER = 'json'
CELERY_TIMEZONE          = TIME_ZONE
CELERY_BEAT_SCHEDULER    = 'django_celery_beat.schedulers:DatabaseScheduler'
