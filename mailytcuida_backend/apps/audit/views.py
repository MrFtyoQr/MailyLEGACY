"""
Audit Log API — read-only.

  GET /api/v1/audit/                  — ADMIN: full log with filters
  GET /api/v1/audit/my/               — any authenticated user: their own actions
  GET /api/v1/audit/patient/<id>/     — DOCTOR of patient or ADMIN: patient's log
"""
from django.shortcuts import get_object_or_404
from rest_framework import generics
from rest_framework.permissions import IsAuthenticated

from apps.accounts.models import PatientProfile, DoctorPatient
from .models import AuditLog
from .serializers import AuditLogSerializer


class IsAdminRole:
    """DRF-style permission check for ADMIN role."""
    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            getattr(request.user, 'role', '') == 'ADMIN'
        )

    def has_object_permission(self, request, view, obj):
        return self.has_permission(request, view)


class AdminAuditLogView(generics.ListAPIView):
    """ADMIN only — full audit trail with optional filters."""
    permission_classes = [IsAuthenticated, IsAdminRole]
    serializer_class   = AuditLogSerializer

    def get_queryset(self):
        qs      = AuditLog.objects.select_related('actor', 'patient').all()
        params  = self.request.query_params

        action        = params.get('action')
        resource_type = params.get('resource_type')
        actor_email   = params.get('actor_email')
        patient_id    = params.get('patient_id')
        date_from     = params.get('date_from')
        date_to       = params.get('date_to')

        if action:
            qs = qs.filter(action=action)
        if resource_type:
            qs = qs.filter(resource_type=resource_type)
        if actor_email:
            qs = qs.filter(actor_email__icontains=actor_email)
        if patient_id:
            qs = qs.filter(patient__id=patient_id)
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)

        return qs


class MyAuditLogView(generics.ListAPIView):
    """Any authenticated user — only their own actions."""
    permission_classes = [IsAuthenticated]
    serializer_class   = AuditLogSerializer

    def get_queryset(self):
        return AuditLog.objects.filter(actor=self.request.user)


class PatientAuditLogView(generics.ListAPIView):
    """
    Doctor (assigned to patient) or ADMIN: view a specific patient's audit log.
    """
    permission_classes = [IsAuthenticated]
    serializer_class   = AuditLogSerializer

    def get_queryset(self):
        patient = get_object_or_404(PatientProfile, pk=self.kwargs['patient_id'])
        user    = self.request.user

        is_admin = getattr(user, 'role', '') == 'ADMIN'
        is_assigned_doctor = DoctorPatient.objects.filter(
            doctor__user=user, patient=patient, is_active=True
        ).exists()

        if not (is_admin or is_assigned_doctor):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('No tienes acceso al historial de auditoría de este paciente.')

        return AuditLog.objects.filter(patient=patient)
