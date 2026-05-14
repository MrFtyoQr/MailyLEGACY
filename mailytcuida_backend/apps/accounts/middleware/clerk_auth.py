import logging
from django.conf import settings
from django.contrib.auth.models import AnonymousUser
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
import jwt
import requests

logger = logging.getLogger(__name__)

_jwks_cache = {}


def _get_jwks():
    """Obtiene y cachea las claves públicas JWKS de Clerk."""
    if _jwks_cache.get('keys'):
        return _jwks_cache['keys']
    response = requests.get(settings.CLERK_JWKS_URL, timeout=5)
    response.raise_for_status()
    _jwks_cache['keys'] = response.json().get('keys', [])
    return _jwks_cache['keys']


def _verify_clerk_token(token: str) -> dict:
    """Verifica JWT de Clerk y retorna el payload."""
    keys = _get_jwks()
    for key_data in keys:
        try:
            public_key = jwt.algorithms.RSAAlgorithm.from_jwk(key_data)
            payload = jwt.decode(
                token,
                public_key,
                algorithms=['RS256'],
                options={'verify_exp': True},
            )
            return payload
        except jwt.ExpiredSignatureError:
            raise AuthenticationFailed('Token expirado.')
        except jwt.InvalidTokenError:
            continue
    raise AuthenticationFailed('Token inválido.')


class ClerkJWTAuthentication(BaseAuthentication):
    """
    Autenticación DRF via JWT de Clerk.
    Inyecta request.user con el User local correspondiente al clerk_id.
    """

    def authenticate(self, request):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return None

        token = auth_header.split(' ', 1)[1]
        try:
            payload = _verify_clerk_token(token)
        except AuthenticationFailed:
            raise
        except Exception as exc:
            logger.error('Error verificando token Clerk: %s', exc)
            raise AuthenticationFailed('Error de autenticación.')

        clerk_id = payload.get('sub')
        if not clerk_id:
            raise AuthenticationFailed('Token sin subject.')

        from apps.accounts.models import User, PatientProfile
        try:
            user = User.objects.get(clerk_id=clerk_id, is_active=True)
        except User.DoesNotExist:
            # Webhook no creó al usuario — lo creamos aquí como fallback.
            email = payload.get('email') or f'{clerk_id}@pending.mailyt'
            try:
                user, _ = User.objects.get_or_create(
                    clerk_id=clerk_id,
                    defaults={'email': email, 'role': User.Role.PATIENT},
                )
                PatientProfile.objects.get_or_create(
                    user=user,
                    defaults={'first_name': '', 'last_name': ''},
                )
            except Exception as exc:
                logger.error('Error auto-creando usuario Clerk %s: %s', clerk_id, exc)
                raise AuthenticationFailed('Usuario no encontrado.')

        return (user, token)

    def authenticate_header(self, request):
        return 'Bearer'


class ClerkAuthMiddleware:
    """
    Middleware Django para inyectar AnonymousUser en requests sin JWT.
    La autenticación real la hace ClerkJWTAuthentication en DRF.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if not hasattr(request, 'user'):
            request.user = AnonymousUser()
        return self.get_response(request)
