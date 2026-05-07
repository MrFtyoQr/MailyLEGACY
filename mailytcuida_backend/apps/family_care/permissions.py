from rest_framework.permissions import BasePermission
from .models import FamilyCareLink


class IsCaregiverOfLink(BasePermission):
    """Request user must be the caregiver on the FamilyCareLink (pk in URL)."""

    def has_object_permission(self, request, view, obj):
        if isinstance(obj, FamilyCareLink):
            return obj.caregiver == request.user
        return obj.care_link.caregiver == request.user


class IsPatientOfLink(BasePermission):
    """Request user must be the patient on the FamilyCareLink (pk in URL)."""

    def has_object_permission(self, request, view, obj):
        link = obj if isinstance(obj, FamilyCareLink) else obj.care_link
        return link.patient == request.user


def get_active_link_for_caregiver(pk, caregiver):
    """Return an ACTIVE FamilyCareLink where the given user is caregiver, or None."""
    return FamilyCareLink.objects.filter(
        pk=pk, caregiver=caregiver, status=FamilyCareLink.Status.ACTIVE
    ).first()
