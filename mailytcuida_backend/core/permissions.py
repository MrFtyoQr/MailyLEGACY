from rest_framework.permissions import BasePermission


class IsDoctor(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.role == 'DOCTOR')


class IsPatient(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.role == 'PATIENT')


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.role == 'ADMIN')


class IsSpecialist(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.role == 'SPECIALIST')


class IsPartner(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.role == 'PARTNER')


class IsPatientOwner(BasePermission):
    """Verifica que el objeto pertenece al paciente autenticado."""
    def has_object_permission(self, request, view, obj):
        return obj.patient.user == request.user


class IsDoctorOfPatient(BasePermission):
    """Verifica que el doctor tiene asignado al paciente."""
    def has_object_permission(self, request, view, obj):
        if request.user.role != 'DOCTOR':
            return False
        return obj.patient.doctor_assignments.filter(
            doctor__user=request.user, is_active=True
        ).exists()
