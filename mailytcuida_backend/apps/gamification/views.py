"""
Gamification API.

  GET  /api/v1/gamification/me/              — my PlayerProfile (points, level, streak, badges)
  GET  /api/v1/gamification/me/transactions/ — point history (paginated)
  GET  /api/v1/gamification/me/redemptions/  — redemption history (paginated)
  GET  /api/v1/gamification/badges/          — all available badges
  GET  /api/v1/gamification/leaderboard/     — top patients (anonymous names optional)

  Doctor:
  GET  /api/v1/gamification/patient/<id>/    — view a patient's gamification profile
"""
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.accounts.models import PatientProfile, DoctorPatient
from . import engine
from .models import PlayerProfile, PointTransaction, Badge, RewardProduct, RedemptionRecord
from .rewards_catalog import ensure_default_rewards
from .serializers import (
    PlayerProfileSerializer, PointTransactionSerializer,
    BadgeSerializer, LeaderboardEntrySerializer, RewardProductSerializer,
    RedemptionSerializer,
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
        player  = (
            PlayerProfile.objects
            .prefetch_related('earned_badges__badge')
            .get(pk=player.pk)
        )
        return Response(PlayerProfileSerializer(player).data)


class MyTransactionsView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class   = PointTransactionSerializer

    def get_queryset(self):
        patient = _get_patient(self.request)
        player  = _get_or_create_player(patient)
        return PointTransaction.objects.filter(player=player)


class MyRedemptionsView(generics.ListAPIView):
    """
    GET /gamification/me/redemptions/ — historial paginado de canjes del
    paciente autenticado, más reciente primero (Actividad 7).
    """
    permission_classes = [IsAuthenticated]
    serializer_class   = RedemptionSerializer

    def get_queryset(self):
        patient = _get_patient(self.request)
        player  = _get_or_create_player(patient)
        return (
            RedemptionRecord.objects
            .filter(player=player)
            .select_related('reward')   # evita N+1 en reward_name / reward_image
            .order_by('-created_at')
        )


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

    def get_queryset(self):
        ensure_default_rewards()
        return RewardProduct.objects.filter(is_active=True)


class RedeemView(APIView):
    """
    POST /gamification/redeem/  — canjea un RewardProduct por puntos.

    Body: {"reward_id": "<uuid>"}
    201 → {"redemption": {...}, "balance": <saldo restante>}
    Errores:
      400 saldo insuficiente          {"code": "insufficient_balance"}
      404 recompensa inexistente      {"code": "reward_not_found"}
      409 recompensa no disponible    {"code": "reward_unavailable"}
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        reward_id    = request.data.get('reward_id')
        points_cost  = request.data.get('points_cost')

        if not reward_id and points_cost is None:
            return Response(
                {'code': 'reward_id_required', 'detail': 'Falta reward_id o points_cost.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        patient = _get_patient(request)
        ensure_default_rewards()

        if not reward_id:
            try:
                points_cost = int(points_cost)
            except (TypeError, ValueError):
                return Response(
                    {'code': 'reward_not_found', 'detail': 'points_cost inválido.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            reward = RewardProduct.objects.filter(
                points_cost=points_cost, is_active=True,
            ).first()
            if reward is None:
                return Response(
                    {'code': 'reward_not_found', 'detail': 'No hay cupón para ese costo.'},
                    status=status.HTTP_404_NOT_FOUND,
                )
            reward_id = reward.id

        try:
            redemption = engine.redeem_reward(patient, reward_id)
        except RewardProduct.DoesNotExist:
            return Response(
                {'code': 'reward_not_found', 'detail': 'La recompensa no existe.'},
                status=status.HTTP_404_NOT_FOUND,
            )
        except engine.RewardUnavailable as exc:
            return Response(
                {'code': 'reward_unavailable', 'detail': str(exc)},
                status=status.HTTP_409_CONFLICT,
            )
        except engine.InsufficientBalance as exc:
            return Response(
                {'code': 'insufficient_balance', 'detail': str(exc)},
                status=status.HTTP_400_BAD_REQUEST,
            )

        redemption.player.refresh_from_db(fields=['balance'])
        return Response(
            {
                'redemption': RedemptionSerializer(redemption).data,
                'balance': redemption.player.balance,
            },
            status=status.HTTP_201_CREATED,
        )


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
