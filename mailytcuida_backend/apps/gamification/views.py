"""
Gamification API.

  GET  /api/v1/gamification/me/              — my PlayerProfile (points, level, streak, badges)
  GET  /api/v1/gamification/me/transactions/ — point history (paginated)
  GET  /api/v1/gamification/badges/          — all available badges
  GET  /api/v1/gamification/leaderboard/     — top patients (anonymous names optional)

  Doctor:
  GET  /api/v1/gamification/patient/<id>/    — view a patient's gamification profile
"""
from django.shortcuts import get_object_or_404
from rest_framework import generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.accounts.models import PatientProfile, DoctorPatient
from .models import PlayerProfile, PointTransaction, Badge, RewardProduct
from .serializers import (
    PlayerProfileSerializer, PointTransactionSerializer,
    BadgeSerializer, LeaderboardEntrySerializer, RewardProductSerializer,
)


def _get_patient(request):
    return get_object_or_404(PatientProfile, user=request.user)


def _get_or_create_player(patient):
    player, _ = PlayerProfile.objects.get_or_create(patient=patient)
    return player


class MyPlayerProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        patient = _get_patient(request)
        player  = _get_or_create_player(patient)
        return Response(PlayerProfileSerializer(player).data)


class MyTransactionsView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class   = PointTransactionSerializer

    def get_queryset(self):
        patient = _get_patient(self.request)
        player  = _get_or_create_player(patient)
        return PointTransaction.objects.filter(player=player)


class BadgeListView(generics.ListAPIView):
    """All available badges — useful for showing locked/unlocked state in the app."""
    permission_classes = [IsAuthenticated]
    serializer_class   = BadgeSerializer
    queryset           = Badge.objects.filter(is_active=True)


class LeaderboardView(generics.ListAPIView):
    """
    Top 50 patients by total points.
    Names are shown — patients accept this when they join.
    Future: add opt-out field to PlayerProfile.
    """
    permission_classes = [IsAuthenticated]
    serializer_class   = LeaderboardEntrySerializer

    def get_queryset(self):
        return PlayerProfile.objects.select_related(
            'patient'
        ).order_by('-total_points')[:50]


class RewardProductListView(generics.ListAPIView):
    """Active redeemable products — shown in the gamification screen."""
    permission_classes = [IsAuthenticated]
    serializer_class   = RewardProductSerializer
    queryset           = RewardProduct.objects.filter(is_active=True)


class DoctorPatientGameView(APIView):
    """Doctor views a specific patient's gamification profile."""
    permission_classes = [IsAuthenticated]

    def get(self, request, patient_id):
        patient = get_object_or_404(PatientProfile, pk=patient_id)
        # Only assigned doctor or admin
        is_admin = getattr(request.user, 'role', '') == 'ADMIN'
        is_assigned = DoctorPatient.objects.filter(
            doctor__user=request.user, patient=patient, is_active=True
        ).exists()
        if not (is_admin or is_assigned):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied()

        player = _get_or_create_player(patient)
        return Response(PlayerProfileSerializer(player).data)
