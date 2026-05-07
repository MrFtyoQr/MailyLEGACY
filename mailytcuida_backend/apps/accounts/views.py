import uuid
import boto3
from django.conf import settings
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
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
