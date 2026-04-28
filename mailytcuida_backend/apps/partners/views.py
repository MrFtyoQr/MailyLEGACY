"""
Partner Portal API.

ADMIN:
  GET/POST   /api/v1/partners/organizations/          — manage organizations
  GET/PATCH  /api/v1/partners/organizations/<id>/     — detail / update
  POST       /api/v1/partners/organizations/<id>/enroll/   — enroll a patient
  DELETE     /api/v1/partners/organizations/<id>/members/<mid>/ — remove member

PARTNER role (org admin):
  GET  /api/v1/partners/dashboard/               — my org dashboard
  GET  /api/v1/partners/members/                 — member list (anonymized)
  GET  /api/v1/partners/snapshots/               — historical snapshots

PATIENT:
  GET  /api/v1/partners/my-enrollments/          — my enrollments
  POST /api/v1/partners/my-enrollments/<id>/consent/ — grant/revoke consent
"""
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.accounts.models import PatientProfile
from .models import PartnerOrganization, PartnerAdmin, MemberEnrollment, PartnerHealthSnapshot
from .serializers import (
    PartnerOrganizationSerializer, MemberEnrollmentSerializer,
    EnrollmentConsentSerializer, PartnerHealthSnapshotSerializer,
    PartnerDashboardSerializer,
)


def _require_admin(request):
    if getattr(request.user, 'role', '') != 'ADMIN':
        from rest_framework.exceptions import PermissionDenied
        raise PermissionDenied('Solo administradores CAMSA pueden realizar esta acción.')


def _get_partner_org(request):
    """Return the PartnerOrganization for the currently authenticated PARTNER user."""
    pa = get_object_or_404(PartnerAdmin, user=request.user)
    return pa.organization


# ── ADMIN: organization management ───────────────────────────────────────────

class OrganizationListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class   = PartnerOrganizationSerializer

    def get_queryset(self):
        _require_admin(self.request)
        return PartnerOrganization.objects.all()

    def perform_create(self, serializer):
        _require_admin(self.request)
        serializer.save()


class OrganizationDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class   = PartnerOrganizationSerializer
    http_method_names  = ['get', 'patch']

    def get_object(self):
        _require_admin(self.request)
        return get_object_or_404(PartnerOrganization, pk=self.kwargs['pk'])


class EnrollPatientView(APIView):
    """ADMIN enrolls a patient in an organization."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        _require_admin(request)
        org        = get_object_or_404(PartnerOrganization, pk=pk)
        patient_id = request.data.get('patient_id')
        employee_id = request.data.get('employee_id', '')

        if not patient_id:
            return Response({'detail': 'patient_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Check seat capacity
        current = org.enrollments.filter(is_active=True).count()
        if current >= org.max_members:
            return Response(
                {'detail': f'Organización al límite de {org.max_members} miembros.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        patient = get_object_or_404(PatientProfile, pk=patient_id)
        enrollment, created = MemberEnrollment.objects.get_or_create(
            organization=org, patient=patient,
            defaults={'employee_id': employee_id, 'is_active': True},
        )
        if not created and not enrollment.is_active:
            enrollment.is_active = True
            enrollment.employee_id = employee_id or enrollment.employee_id
            enrollment.save(update_fields=['is_active', 'employee_id'])

        # Notify patient about enrollment
        try:
            from apps.notifications.service import notify
            notify(
                user    = patient.user,
                code    = 'PARTNER_ENROLLED',
                context = {'organization_name': org.name},
                channel = 'PUSH',
            )
        except Exception:
            pass

        return Response(
            MemberEnrollmentSerializer(enrollment, context={'request': request}).data,
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class RemoveMemberView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk, mid):
        _require_admin(request)
        org        = get_object_or_404(PartnerOrganization, pk=pk)
        enrollment = get_object_or_404(MemberEnrollment, pk=mid, organization=org)
        enrollment.is_active = False
        enrollment.save(update_fields=['is_active'])
        return Response(status=status.HTTP_204_NO_CONTENT)


# ── PARTNER role: portal views ────────────────────────────────────────────────

class PartnerDashboardView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        org      = _get_partner_org(request)
        snapshot = PartnerHealthSnapshot.objects.filter(organization=org).first()

        trend = list(
            PartnerHealthSnapshot.objects.filter(organization=org)
            .order_by('-period_start')[:12]
            .values('period_start', 'avg_adherence_pct', 'active_members', 'is_suppressed')
        )

        data = {
            'organization':     org,
            'latest_snapshot':  snapshot,
            'trend_adherence':  trend,
            'enrollment_count': org.enrollments.filter(is_active=True).count(),
            'consenting_count': org.enrollments.filter(is_active=True, consent=True).count(),
            'seats_available':  max(0, org.max_members - org.enrollments.filter(is_active=True).count()),
        }
        return Response(PartnerDashboardSerializer(data).data)


class PartnerMemberListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class   = MemberEnrollmentSerializer

    def get_queryset(self):
        org = _get_partner_org(self.request)
        return MemberEnrollment.objects.filter(organization=org, is_active=True)

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['request'] = self.request
        return ctx


class PartnerSnapshotListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class   = PartnerHealthSnapshotSerializer

    def get_queryset(self):
        org = _get_partner_org(self.request)
        return PartnerHealthSnapshot.objects.filter(organization=org)


# ── PATIENT: my enrollments ───────────────────────────────────────────────────

class MyEnrollmentsView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class   = MemberEnrollmentSerializer

    def get_queryset(self):
        patient = get_object_or_404(PatientProfile, user=self.request.user)
        return MemberEnrollment.objects.filter(patient=patient, is_active=True)


class EnrollmentConsentView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, mid):
        patient    = get_object_or_404(PatientProfile, user=request.user)
        enrollment = get_object_or_404(MemberEnrollment, pk=mid, patient=patient, is_active=True)
        ser = EnrollmentConsentSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        enrollment.consent = ser.validated_data['consent']
        enrollment.consent_at = timezone.now() if enrollment.consent else None
        enrollment.save(update_fields=['consent', 'consent_at'])

        return Response({
            'consent':    enrollment.consent,
            'consent_at': enrollment.consent_at,
        })
