"""
Gamification engine — single public entry point: award_points().

Usage (from any module's signal or task):
    from apps.gamification.engine import award_points, PointSource

    award_points(
        patient   = medication_history.patient,
        source    = PointSource.MEDICATION_TAKEN,
        ref_id    = str(medication_history.id),
    )

The engine:
  1. Gets or creates the PlayerProfile.
  2. Resolves the plan multiplier for the patient.
  3. Creates an immutable PointTransaction.
  4. Updates PlayerProfile.total_points and recalculates level.
  5. Updates the daily streak.
  6. Checks and awards any newly unlocked badges.
  7. Returns the transaction so callers can inspect awarded points.
"""
import logging
from datetime import date

from django.db import transaction as db_transaction
from django.db import IntegrityError

from .models import (
    PlayerProfile, PointTransaction, PlayerBadge, Badge,
    RewardProduct, RedemptionRecord,
    PointSource, BASE_POINTS, PLAN_MULTIPLIERS, BadgeCategory,
)

logger = logging.getLogger(__name__)


# ── Excepciones de dominio del canje ───────────────────────────────────────────
# Se lanzan desde redeem_reward() y la vista las mapea a códigos HTTP.

class RedemptionError(Exception):
    """Base para los errores de negocio del flujo de canje."""


class RewardUnavailable(RedemptionError):
    """La recompensa está inactiva o su stock finito se agotó."""


class InsufficientBalance(RedemptionError):
    """El saldo gastable del jugador no alcanza el costo de la recompensa."""


def award_points(
    patient,
    source: str,
    ref_id: str = '',
    base_points: int | None = None,
    note: str = '',
) -> PointTransaction | None:
    """
    Award points to a patient for a given action.
    Thread-safe via select_for_update.
    Returns the created PointTransaction or None on failure.
    """
    try:
        with db_transaction.atomic():
            player, _ = PlayerProfile.objects.select_for_update().get_or_create(
                patient=patient
            )

            bp         = base_points if base_points is not None else BASE_POINTS.get(source, 0)
            multiplier = _get_multiplier(patient)
            total_pts  = bp * multiplier

            txn = PointTransaction.objects.create(
                player      = player,
                source      = source,
                base_points = bp,
                multiplier  = multiplier,
                points      = total_pts,
                ref_id      = str(ref_id)[:64],
                note        = note[:255],
            )

            # Los awards alimentan tanto el lifetime (total_points, rige nivel)
            # como el saldo gastable (balance).
            player.total_points += total_pts
            player.balance      += total_pts
            _update_streak(player, source)
            player.level = player.compute_level()
            player.save(update_fields=['total_points', 'balance', 'current_streak',
                                       'longest_streak', 'last_activity_date', 'level'])

            _check_badges(player)

            logger.debug(
                'Points awarded: patient=%s source=%s pts=%d (×%d)',
                patient.id, source, total_pts, multiplier,
            )
            return txn

    except IntegrityError:
        # Evento duplicado: ya existe una transacción para este
        # (player, source, ref_id). Se omite silenciosamente — el deduplicado
        # es comportamiento esperado, no un error. La restricción
        # unique_points_per_event garantiza la integridad a nivel de BD.
        logger.debug(
            'award_points: evento duplicado omitido patient=%s source=%s ref_id=%s',
            patient.id, source, ref_id,
        )
        return None
    except Exception as exc:
        logger.error('award_points failed for patient=%s: %s', patient.id, exc, exc_info=True)
        return None


def redeem_reward(patient, reward_id) -> RedemptionRecord:
    """
    Canjea un RewardProduct por puntos del saldo gastable del paciente.

    Todo ocurre en una única transacción atómica con bloqueo pesimista
    (select_for_update) en orden fijo PlayerProfile → RewardProduct para
    prevenir condiciones de carrera y deadlocks:

      1. Bloquea el PlayerProfile y la RewardProduct.
      2. Valida disponibilidad (activa, con stock) y saldo suficiente.
      3. Crea el RedemptionRecord (código único autogenerado).
      4. Registra el débito en el ledger (PointTransaction con points negativos)
         y lo enlaza al RedemptionRecord (trazabilidad).
      5. Debita PlayerProfile.balance (total_points/level quedan intactos → el
         nivel nunca baja por canjear).
      6. Decrementa el stock finito; al agotarse lo desactiva (is_active=False)
         para no colisionar con la semántica stock==0 = ilimitado.

    Lanza RewardUnavailable o InsufficientBalance ante fallos de negocio;
    RewardProduct.DoesNotExist si la recompensa no existe.
    Devuelve el RedemptionRecord creado.
    """
    with db_transaction.atomic():
        player, _ = PlayerProfile.objects.select_for_update().get_or_create(
            patient=patient
        )
        reward = RewardProduct.objects.select_for_update().get(pk=reward_id)

        if not reward.is_active:
            raise RewardUnavailable('La recompensa no está disponible.')
        # stock == 0 = ilimitado; un producto finito agotado ya se habría
        # desactivado (is_active=False) al llegar aquí, pero se valida por
        # defensa en profundidad.
        if reward.stock != 0 and reward.stock < 1:
            raise RewardUnavailable('La recompensa está agotada.')
        if player.balance < reward.points_cost:
            raise InsufficientBalance(
                f'Saldo insuficiente: balance={player.balance}, '
                f'costo={reward.points_cost}.'
            )

        redemption = RedemptionRecord.objects.create(
            player       = player,
            reward       = reward,
            points_spent = reward.points_cost,
        )

        txn = PointTransaction.objects.create(
            player      = player,
            source      = PointSource.REDEMPTION,
            base_points = -reward.points_cost,
            multiplier  = 1,
            points      = -reward.points_cost,
            ref_id      = str(redemption.id),
            note        = f'Canje {redemption.code}: {reward.name}'[:255],
        )
        redemption.point_transaction = txn
        redemption.save(update_fields=['point_transaction'])

        # El canje solo debita el saldo gastable; total_points y level intactos.
        player.balance -= reward.points_cost
        player.save(update_fields=['balance'])

        if reward.stock > 0:  # producto finito
            reward.stock -= 1
            if reward.stock == 0:  # última unidad → desactivar (Hallazgo A)
                reward.is_active = False
            reward.save(update_fields=['stock', 'is_active'])

        logger.info(
            'Canje realizado: patient=%s reward=%s code=%s -%dpts (balance=%d)',
            patient.id, reward.id, redemption.code, reward.points_cost, player.balance,
        )
        return redemption


# ── Internal helpers ──────────────────────────────────────────────────────────

def _get_multiplier(patient) -> int:
    try:
        subscription = patient.user.subscription
        tier = subscription.plan.tier if subscription and subscription.plan else 'FREE'
    except Exception:
        tier = 'FREE'
    return PLAN_MULTIPLIERS.get(tier, 1)


def _update_streak(player: PlayerProfile, source: str):
    """Update consecutive-day streak for MEDICATION_TAKEN events."""
    if source != PointSource.MEDICATION_TAKEN:
        return

    today = date.today()
    last  = player.last_activity_date

    if last is None or (today - last).days > 1:
        player.current_streak = 1
    elif (today - last).days == 1:
        player.current_streak += 1
    # same day — no change to streak

    player.last_activity_date = today
    if player.current_streak > player.longest_streak:
        player.longest_streak = player.current_streak

    # Award streak bonus at 7, 14, 30, 60, 90 day milestones
    milestones = {7, 14, 30, 60, 90}
    if player.current_streak in milestones:
        bp         = BASE_POINTS[PointSource.STREAK_BONUS]
        multiplier = _get_multiplier(player.patient)
        PointTransaction.objects.create(
            player      = player,
            source      = PointSource.STREAK_BONUS,
            base_points = bp,
            multiplier  = multiplier,
            points      = bp * multiplier,
            note        = f'{player.current_streak}-day streak',
        )
        player.total_points += bp * multiplier
        player.balance      += bp * multiplier


def _check_badges(player: PlayerProfile):
    """Award any badges the player has now unlocked but not yet earned."""
    already_earned = set(
        player.earned_badges.values_list('badge_id', flat=True)
    )
    candidates = Badge.objects.filter(is_active=True).exclude(id__in=already_earned)

    for badge in candidates:
        if _qualifies(player, badge):
            pb = PlayerBadge.objects.create(player=player, badge=badge)
            # Award badge points bonus
            if badge.points_reward:
                player.total_points += badge.points_reward
                player.balance      += badge.points_reward
                PointTransaction.objects.create(
                    player      = player,
                    source      = PointSource.MANUAL_ADJUSTMENT,
                    base_points = badge.points_reward,
                    multiplier  = 1,
                    points      = badge.points_reward,
                    note        = f'Badge: {badge.code}',
                )
                player.save(update_fields=['total_points', 'balance'])

            # Notify patient
            try:
                from apps.notifications.service import notify
                notify(
                    user    = player.patient.user,
                    code    = 'BADGE_EARNED',
                    context = {'badge_name': badge.name, 'badge_description': badge.description},
                    channel = 'PUSH',
                )
            except Exception:
                pass

            logger.info('Badge earned: patient=%s badge=%s', player.patient.id, badge.code)


def _qualifies(player: PlayerProfile, badge: Badge) -> bool:
    """Check if the player has met the threshold for a badge."""
    cat = badge.category
    thr = badge.threshold

    if cat == BadgeCategory.STREAK:
        return player.longest_streak >= thr

    if cat == BadgeCategory.ADHERENCE:
        taken = PointTransaction.objects.filter(
            player=player, source=PointSource.MEDICATION_TAKEN
        ).count()
        return taken >= thr

    if cat == BadgeCategory.VITALS:
        logged = PointTransaction.objects.filter(
            player=player, source=PointSource.VITAL_LOGGED
        ).count()
        return logged >= thr

    if cat == BadgeCategory.MILESTONE:
        return player.total_points >= thr

    if cat == BadgeCategory.SOCIAL:
        completed = PointTransaction.objects.filter(
            player=player, source=PointSource.REFERRAL_COMPLETED
        ).count()
        return completed >= thr

    return False
