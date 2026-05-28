"""
auth_views.py — Autenticación propia (sin Clerk)

Endpoints:
  POST /api/v1/auth/register/   — Registro con email + contraseña
  POST /api/v1/auth/login/      — Login; devuelve access + refresh tokens
  POST /api/v1/auth/refresh/    — Refresca el access token
  POST /api/v1/auth/logout/     — Invalida el refresh token (blacklist)
  POST /api/v1/auth/set-password/ — Permite que usuarios Clerk migrados
                                    establezcan su primera contraseña
"""

import logging
from django.contrib.auth import authenticate
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError, InvalidToken
from rest_framework_simplejwt.views import TokenRefreshView

from .models import User, PatientProfile
from apps.audit.logger import audit
from apps.audit.models import AuditAction, ResourceType

logger = logging.getLogger(__name__)


class RegisterView(APIView):
    """
    POST /api/v1/auth/register/
    Crea un usuario nativo (sin Clerk) y devuelve tokens JWT.
    """
    authentication_classes = []
    permission_classes      = [permissions.AllowAny]

    def post(self, request):
        email      = request.data.get('email', '').strip().lower()
        password   = request.data.get('password', '')
        role       = request.data.get('role', User.Role.PATIENT)
        first_name = request.data.get('first_name', '')
        last_name  = request.data.get('last_name', '')

        # Validaciones básicas
        if not email or not password:
            return Response({'error': 'Email y contraseña requeridos.'}, status=400)
        if len(password) < 8:
            return Response({'error': 'La contraseña debe tener al menos 8 caracteres.'}, status=400)
        if User.objects.filter(email=email).exists():
            return Response({'error': 'Este email ya está registrado.'}, status=400)
        if role not in {c[0] for c in User.Role.choices}:
            role = User.Role.PATIENT

        user = User.objects.create_user(email=email, password=password, role=role)

        # Crear perfil base según rol
        if role == User.Role.PATIENT:
            PatientProfile.objects.get_or_create(
                user=user,
                defaults={'first_name': first_name, 'last_name': last_name},
            )

        refresh = RefreshToken.for_user(user)
        logger.info('Usuario registrado: %s (rol=%s)', email, role)

        # ── Audit: registro exitoso ──────────────────────────────────────────
        audit(
            request=request,
            actor=user,
            action=AuditAction.CREATE,
            resource_type=ResourceType.USER,
            resource_id=str(user.id),
            patient=None,
            changed_fields=['email', 'role', 'password'],
            note=f'Nuevo usuario registrado: {email} (rol={role})',
            http_status=201,
        )

        return Response({
            'access':  str(refresh.access_token),
            'refresh': str(refresh),
            'user': {
                'id':    str(user.id),
                'email': user.email,
                'role':  user.role,
            },
        }, status=status.HTTP_201_CREATED)


class LoginView(APIView):
    """
    POST /api/v1/auth/login/
    Autentica con email + contraseña y devuelve tokens JWT.
    """
    authentication_classes = []
    permission_classes      = [permissions.AllowAny]

    def post(self, request):
        email    = request.data.get('email', '').strip().lower()
        password = request.data.get('password', '')

        if not email or not password:
            return Response({'error': 'Email y contraseña requeridos.'}, status=400)

        # ModelBackend con USERNAME_FIELD='email' espera keyword 'username'
        user = authenticate(request, username=email, password=password)

        if user is None:
            logger.warning('Intento de login fallido: %s', email)

            # ── Audit: intento fallido ───────────────────────────────────────
            audit(
                request=request,
                actor=None,
                actor_email=email,          # Email intentado (sin usuario real)
                action=AuditAction.ACCESS_DENIED,
                resource_type=ResourceType.USER,
                resource_id='',
                patient=None,
                changed_fields=[],
                note=f'Intento de inicio de sesión fallido para: {email}',
                http_status=401,
            )

            return Response({'error': 'Credenciales incorrectas.'}, status=401)

        if not user.is_active:
            return Response({'error': 'Cuenta inactiva.'}, status=401)

        refresh = RefreshToken.for_user(user)
        logger.info('Login exitoso: %s', email)

        # ── Audit: login exitoso ─────────────────────────────────────────────
        audit(
            request=request,
            actor=user,
            action=AuditAction.LOGIN,
            resource_type=ResourceType.USER,
            resource_id=str(user.id),
            patient=None,
            changed_fields=[],
            note=f'Inicio de sesión exitoso: {email} (rol={user.role})',
            http_status=200,
        )

        return Response({
            'access':  str(refresh.access_token),
            'refresh': str(refresh),
            'user': {
                'id':    str(user.id),
                'email': user.email,
                'role':  user.role,
            },
        })


class LogoutView(APIView):
    """
    POST /api/v1/auth/logout/
    Invalida el refresh token (lo añade a la blacklist de simplejwt).
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        actor = request.user
        refresh_token = request.data.get('refresh')

        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                token.blacklist()
            except (TokenError, InvalidToken):
                pass  # Token ya inválido — no error

        # ── Audit: logout ────────────────────────────────────────────────────
        audit(
            request=request,
            actor=actor,
            action=AuditAction.LOGOUT,
            resource_type=ResourceType.USER,
            resource_id=str(actor.id),
            patient=None,
            changed_fields=[],
            note=f'Cierre de sesión: {actor.email}',
            http_status=204,
        )

        return Response(status=status.HTTP_204_NO_CONTENT)


class SetPasswordView(APIView):
    """
    POST /api/v1/auth/set-password/
    Permite que usuarios migrados de Clerk establezcan su primera contraseña.
    Requiere estar autenticado (con JWT si ya tienen uno, o vía Django admin).
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        new_password = request.data.get('new_password', '')
        if len(new_password) < 8:
            return Response({'error': 'La contraseña debe tener al menos 8 caracteres.'}, status=400)

        request.user.set_password(new_password)
        request.user.save(update_fields=['password'])

        # Invalidar tokens anteriores rotando el refresh
        refresh_token = request.data.get('refresh')
        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                token.blacklist()
            except (TokenError, InvalidToken):
                pass

        logger.info('Contraseña actualizada: %s', request.user.email)
        return Response({'detail': 'Contraseña actualizada.'})


# Re-exportar la vista de refresh de simplejwt para no duplicar lógica
NativeTokenRefreshView = TokenRefreshView
