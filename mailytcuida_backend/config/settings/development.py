from .base import *  # noqa

DEBUG = True

ALLOWED_HOSTS = ['*']

INSTALLED_APPS += ['debug_toolbar']

MIDDLEWARE = ['debug_toolbar.middleware.DebugToolbarMiddleware'] + MIDDLEWARE

INTERNAL_IPS = ['127.0.0.1']

# ── Dev auth bypass (Postman testing without Clerk JWT) ───────────────────────
# Prepend DevBypassAuthentication so it runs before ClerkJWTAuthentication.
# Only active when DEBUG=True AND DEV_AUTH_BYPASS=True in .env.dev
REST_FRAMEWORK['DEFAULT_AUTHENTICATION_CLASSES'] = [
    'apps.accounts.middleware.dev_auth.DevBypassAuthentication',
    'apps.accounts.middleware.clerk_auth.ClerkJWTAuthentication',
]

# Logs detallados en desarrollo
LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'handlers': {
        'console': {'class': 'logging.StreamHandler'},
    },
    'root': {
        'handlers': ['console'],
        'level': 'DEBUG',
    },
    'loggers': {
        'django.db.backends': {
            'handlers': ['console'],
            'level': 'DEBUG',
            'propagate': False,
        },
    },
}

# Email en consola durante desarrollo
EMAIL_BACKEND = 'django.core.mail.backends.console.EmailBackend'
