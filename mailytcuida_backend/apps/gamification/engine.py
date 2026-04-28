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

from .models import (
    PlayerProfile, PointTransaction, PlayerBadge, Badge,
    PointSource, BASE_POINTS, PLAN_MULTIPLIERS, BadgeCategory,
)

logger = logging.getLogger(__name__)


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

            player.total_points += total_pts
            _update_streak(player, source)
            player.level = player.compute_level()
            player.save(update_fields=['total_points', 'current_streak',
                                       'longest_streak', 'last_activity_date', 'level'])

            _check_badges(player)

            logger.debug(
                'Points awarded: patient=%s source=%s pts=%d (×%d)',
                patient.id, source, total_pts, multiplier,
            )
            return txn

    except Exception as exc:
        logger.error('award_points failed for patient=%s: %s', patient.id, exc, exc_info=True)
        return None


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
        multiplier = PLAN_MULTIPLIERS.get('FREE', 1)  # already inside atomic; re-fetch if needed
        PointTransaction.objects.create(
            player      = player,
            source      = PointSource.STREAK_BONUS,
            base_points = bp,
            multiplier  = multiplier,
            points      = bp * multiplier,
            note        = f'{player.current_streak}-day streak',
        )
        player.total_points += bp * multiplier


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
                PointTransaction.objects.create(
                    player      = player,
                    source      = PointSource.MILESTONE,
                    base_points = badge.points_reward,
                    multiplier  = 1,
                    points      = badge.points_reward,
                    note        = f'Badge: {badge.code}',
                )
                player.save(update_fields=['total_points'])

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
