import uuid
import boto3
from django.conf import settings
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.response import Response
from rest_framework.views import APIView

from core.permissions import IsDoctor, IsPatient, IsSpecialist, IsPartner, IsAdmin
from core.throttles import PhotoUploadThrottle
from .models import User, PatientProfile, DoctorProfile, DoctorPatient, SpecialistProfile, PartnerProfile
from .serializers import (
    MeSerializer, PatientProfileSerializer, DoctorProfileSerializer,
    SpecialistProfileSerializer, PartnerProfileSerializer,
    DoctorPatientSerializer, UserAdminSerializer, PhotoUploadSerializer,
)


# ── Auth me ───────────────────────────────────────────────────────────────────

class MeView(generics.RetrieveUpdateAPIView):
    """GET/PATCH /api/v1/auth/me/"""
    serializer_class = MeSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        return self.request.user

    def retrieve(self, request, *args, **kwargs):
        """Devuelve { user, profile, is_complete } para el frontend."""
        user = self.get_object()

        profile_data = None
        is_complete   = False

        if user.role == User.Role.PATIENT:
            try:
                p = user.patient_profile
                profile_data = PatientProfileSerializer(p).data
                is_complete  = bool(p.first_name and p.last_name)
            except PatientProfile.DoesNotExist:
                pass
        elif user.role == User.Role.DOCTOR:
            try:
                p = user.doctor_profile
                profile_data = DoctorProfileSerializer(p).data
                is_complete  = bool(p.first_name and p.last_name and p.license_number)
            except DoctorProfile.DoesNotExist:
                pass
        elif user.role == User.Role.SPECIALIST:
            try:
                p = user.specialist_profile
                profile_data = SpecialistProfileSerializer(p).data
                is_complete  = bool(p.first_name and p.last_name)
            except SpecialistProfile.DoesNotExist:
                pass

        return Response({
            'user': {
                'id':         str(user.id),
                'clerk_id':   user.clerk_id,
                'email':      user.email,
                'role':       user.role,
                'is_active':  user.is_active,
                'created_at': user.created_at.isoformat(),
            },
            'profile':     profile_data,
            'is_complete': is_complete,
        })


# ── Auth init (LEGADO — Clerk fallback, conservado para app móvil) ────────────

class AuthInitView(APIView):
    """
    POST /api/v1/auth/init/
    LEGADO: Registraba al usuario cuando llegaba un token Clerk.
    Ahora redirige al sistema nativo si el cliente no usa Clerk.
    Conservado para compatibilidad con la app móvil durante la migración.
    """
    authentication_classes = []
    permission_classes      = [permissions.AllowAny]

    def post(self, request):
        # Intentar autenticación Clerk legada (si las claves están configuradas)
        from django.conf import settings
        if not settings.CLERK_JWKS_URL or not settings.CLERK_SECRET_KEY:
            return Response(
                {'error': 'Endpoint Clerk no disponible. Usar /auth/login/'},
                status=status.HTTP_410_GONE,
            )

        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return Response({'error': 'Token requerido'}, status=status.HTTP_401_UNAUTHORIZED)

        token = auth_header.split(' ', 1)[1]

        # Importar solo si Clerk sigue configurado
        try:
            from .middleware.clerk_auth import _verify_clerk_token
            payload = _verify_clerk_token(token)
        except (ImportError, AuthenticationFailed) as exc:
            return Response({'error': str(exc)}, status=status.HTTP_401_UNAUTHORIZED)

        clerk_id = payload.get('sub')
        if not clerk_id:
            return Response({'error': 'Token inválido'}, status=status.HTTP_400_BAD_REQUEST)

        email = request.data.get('email') or f'{clerk_id}@pending.mailyt'

        user, created = User.objects.get_or_create(
            clerk_id=clerk_id,
            defaults={'email': email, 'role': User.Role.PATIENT},
        )

        if not created and user.email.endswith('@pending.mailyt') and request.data.get('email'):
            user.email = request.data['email']
            user.save(update_fields=['email', 'updated_at'])

        if user.role == User.Role.PATIENT:
            PatientProfile.objects.get_or_create(
                user=user,
                defaults={'first_name': '', 'last_name': ''},
            )

        return Response({'status': 'ok', 'created': created})


class RoleView(APIView):
    """GET /api/v1/auth/me/role/"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response({
            'role': request.user.role,
            'permissions': _permissions_for_role(request.user.role),
        })


# ── Perfil paciente ───────────────────────────────────────────────────────────

class PatientProfileView(generics.RetrieveUpdateAPIView):
    """GET/PATCH /api/v1/auth/profiles/patient/"""
    serializer_class = PatientProfileSerializer
    permission_classes = [permissions.IsAuthenticated, IsPatient]

    def get_object(self):
        profile, _ = PatientProfile.objects.get_or_create(
            user=self.request.user,
            defaults={'first_name': '', 'last_name': ''},
        )
        return profile


class PatientPhotoView(APIView):
    """POST /api/v1/auth/profiles/patient/photo/"""
    permission_classes = [permissions.IsAuthenticated, IsPatient]
    throttle_classes = [PhotoUploadThrottle]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        serializer = PhotoUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        url = _upload_photo(serializer.validated_data['photo'], folder='patients')
        profile = request.user.patient_profile
        profile.photo_url = url
        profile.save(update_fields=['photo_url'])
        return Response({'photo_url': url}, status=status.HTTP_200_OK)


# ── Perfil doctor ─────────────────────────────────────────────────────────────

class DoctorProfileView(generics.RetrieveUpdateAPIView):
    """GET/PATCH /api/v1/auth/profiles/doctor/"""
    serializer_class = DoctorProfileSerializer
    permission_classes = [permissions.IsAuthenticated, IsDoctor]

    def get_object(self):
        return get_object_or_404(DoctorProfile, user=self.request.user)


class DoctorPhotoView(APIView):
    """POST /api/v1/auth/profiles/doctor/photo/"""
    permission_classes = [permissions.IsAuthenticated, IsDoctor]
    throttle_classes = [PhotoUploadThrottle]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        serializer = PhotoUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        url = _upload_photo(serializer.validated_data['photo'], folder='doctors')
        profile = request.user.doctor_profile
        profile.photo_url = url
        profile.save(update_fields=['photo_url'])
        return Response({'photo_url': url}, status=status.HTTP_200_OK)


# ── Perfil especialista ───────────────────────────────────────────────────────

class SpecialistProfileView(generics.RetrieveUpdateAPIView):
    """GET/PATCH /api/v1/auth/profiles/specialist/"""
    serializer_class = SpecialistProfileSerializer
    permission_classes = [permissions.IsAuthenticated, IsSpecialist]

    def get_object(self):
        return get_object_or_404(SpecialistProfile, user=self.request.user)


# ── Perfil partner ────────────────────────────────────────────────────────────

class PartnerProfileView(generics.RetrieveUpdateAPIView):
    """GET/PATCH /api/v1/auth/profiles/partner/"""
    serializer_class = PartnerProfileSerializer
    permission_classes = [permissions.IsAuthenticated, IsPartner]

    def get_object(self):
        return get_object_or_404(PartnerProfile, user=self.request.user)


# ── Doctor — gestión de pacientes ────────────────────────────────────────────

class DoctorPatientListCreateView(generics.ListCreateAPIView):
    """
    GET  /api/v1/auth/doctor/patients/  → listar mis pacientes activos
    POST /api/v1/auth/doctor/patients/  → asignar paciente por email
    """
    serializer_class = DoctorPatientSerializer
    permission_classes = [permissions.IsAuthenticated, IsDoctor]

    def get_queryset(self):
        return DoctorPatient.objects.filter(
            doctor__user=self.request.user,
            is_active=True,
        ).select_related('patient__user')


class DoctorPatientDetailView(generics.RetrieveDestroyAPIView):
    """
    GET    /api/v1/auth/doctor/patients/{pk}/  → ficha básica de un paciente
    DELETE /api/v1/auth/doctor/patients/{pk}/  → desasignar (soft delete)
    """
    serializer_class = DoctorPatientSerializer
    permission_classes = [permissions.IsAuthenticated, IsDoctor]

    def get_queryset(self):
        return DoctorPatient.objects.filter(
            doctor__user=self.request.user,
            is_active=True,
        )

    def destroy(self, request, *args, **kwargs):
        assignment = self.get_object()
        assignment.is_active = False
        assignment.save(update_fields=['is_active'])
        return Response(status=status.HTTP_204_NO_CONTENT)


# ── Admin ─────────────────────────────────────────────────────────────────────

class AdminUserListView(generics.ListAPIView):
    """GET /api/v1/auth/admin/users/"""
    serializer_class = UserAdminSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    queryset = User.objects.all().order_by('-created_at')


class AdminUserDetailView(generics.RetrieveAPIView):
    """GET /api/v1/auth/admin/users/{pk}/"""
    serializer_class = UserAdminSerializer
    permission_classes = [permissions.IsAuthenticated, IsAdmin]
    queryset = User.objects.all()


# ── Helpers ───────────────────────────────────────────────────────────────────

def _upload_photo(file, folder: str) -> str:
    """Sube imagen a S3/R2 y retorna la URL pública."""
    ext = file.name.rsplit('.', 1)[-1].lower()
    key = f'{folder}/{uuid.uuid4()}.{ext}'
    s3 = boto3.client(
        's3',
        endpoint_url=settings.AWS_S3_ENDPOINT_URL or None,
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
    )
    s3.upload_fileobj(
        file,
        settings.AWS_STORAGE_BUCKET_NAME,
        key,
        ExtraArgs={'ContentType': file.content_type, 'ACL': 'public-read'},
    )
    base = settings.AWS_S3_ENDPOINT_URL or f'https://{settings.AWS_STORAGE_BUCKET_NAME}.s3.amazonaws.com'
    return f'{base}/{key}'


def _permissions_for_role(role: str) -> list:
    base = ['read:own_profile', 'update:own_profile']
    extra = {
        'PATIENT':    ['read:own_vitals', 'create:vitals', 'read:own_medications'],
        'DOCTOR':     ['read:patients', 'read:patient_vitals', 'manage:specialists',
                       'manage:coupons', 'manage:store', 'read:analytics'],
        'SPECIALIST': ['read:assigned_patients', 'create:nutrition_plans'],
        'PARTNER':    ['manage:coupons_external', 'read:coupon_stats'],
        'ADMIN':      ['*'],
    }
    return base + extra.get(role, [])
