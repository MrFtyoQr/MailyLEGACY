import pytest
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from rest_framework_simplejwt.tokens import RefreshToken
from apps.accounts.models import User, PatientProfile
from apps.gamification.models import (
    PlayerProfile, PointTransaction, Badge, PlayerBadge,
    BadgeCategory, PointSource, PLAN_MULTIPLIERS,
    RewardProduct, RedemptionRecord,
)
from apps.gamification.engine import award_points


def _patient(email='p@test.com', clerk_id='pat_001'):
    user    = User.objects.create_user(email=email, clerk_id=clerk_id, role='PATIENT', password='testpass123')
    profile = PatientProfile.objects.create(user=user, first_name='Sofía', last_name='Luna')
    return user, profile


def _jwt_client(user):
    client = APIClient()
    refresh = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {refresh.access_token}')
    return client


def _badge(code='TEST_BADGE', category=BadgeCategory.ADHERENCE, threshold=1, reward=10):
    badge, _ = Badge.objects.get_or_create(
        code=code,
        defaults=dict(name=code, category=category, threshold=threshold, points_reward=reward, is_active=True),
    )
    return badge


@pytest.mark.django_db
class TestPointsEngine(TestCase):

    def setUp(self):
        self.user, self.patient = _patient()

    def test_award_creates_player_profile(self):
        award_points(self.patient, PointSource.MEDICATION_TAKEN)
        self.assertTrue(PlayerProfile.objects.filter(patient=self.patient).exists())

    def test_base_points_correct(self):
        award_points(self.patient, PointSource.MEDICATION_TAKEN)
        player = PlayerProfile.objects.get(patient=self.patient)
        self.assertEqual(player.total_points, 10)  # 10 base × 1 (FREE)

    def test_plan_multiplier_applied(self):
        from apps.payments.models import Plan, Subscription
        plan, _ = Plan.objects.get_or_create(
            tier='SILVER',
            defaults={'name': 'Silver', 'price_mxn': 99, 'max_doctors': 2},
        )
        Subscription.objects.create(user=self.user, plan=plan, status='ACTIVE')
        award_points(self.patient, PointSource.MEDICATION_TAKEN)
        player = PlayerProfile.objects.get(patient=self.patient)
        self.assertEqual(player.total_points, 10 * PLAN_MULTIPLIERS['SILVER'])

    def test_platinum_multiplier(self):
        from apps.payments.models import Plan, Subscription
        plan, _ = Plan.objects.get_or_create(
            tier='PLATINUM',
            defaults={'name': 'Platinum', 'price_mxn': 499, 'max_doctors': 99},
        )
        Subscription.objects.create(user=self.user, plan=plan, status='ACTIVE')
        award_points(self.patient, PointSource.VITAL_LOGGED)
        player = PlayerProfile.objects.get(patient=self.patient)
        self.assertEqual(player.total_points, 5 * PLAN_MULTIPLIERS['PLATINUM'])

    def test_transaction_ledger_created(self):
        award_points(self.patient, PointSource.LAB_UPLOADED, ref_id='lab-001')
        txn = PointTransaction.objects.filter(player__patient=self.patient).first()
        self.assertIsNotNone(txn)
        self.assertEqual(txn.source, PointSource.LAB_UPLOADED)
        self.assertEqual(txn.ref_id, 'lab-001')

    def test_transaction_is_immutable(self):
        award_points(self.patient, PointSource.APPOINTMENT_KEPT)
        txn = PointTransaction.objects.filter(player__patient=self.patient).first()
        txn.points = 9999
        with self.assertRaises(ValueError):
            txn.save()

    def test_level_increases_with_points(self):
        # Award enough points to reach level 2 (threshold 200)
        for _ in range(20):
            award_points(self.patient, PointSource.APPOINTMENT_KEPT)  # 20pts each
        player = PlayerProfile.objects.get(patient=self.patient)
        self.assertGreaterEqual(player.level, 2)

    def test_multiple_sources(self):
        award_points(self.patient, PointSource.MEDICATION_TAKEN)
        award_points(self.patient, PointSource.VITAL_LOGGED)
        award_points(self.patient, PointSource.LAB_UPLOADED)
        player = PlayerProfile.objects.get(patient=self.patient)
        expected = 10 + 5 + 15  # base points, FREE multiplier
        self.assertEqual(player.total_points, expected)


@pytest.mark.django_db
class TestStreaks(TestCase):

    def setUp(self):
        self.user, self.patient = _patient()

    def test_first_day_starts_streak(self):
        award_points(self.patient, PointSource.MEDICATION_TAKEN)
        player = PlayerProfile.objects.get(patient=self.patient)
        self.assertEqual(player.current_streak, 1)

    def test_same_day_no_streak_change(self):
        award_points(self.patient, PointSource.MEDICATION_TAKEN)
        award_points(self.patient, PointSource.MEDICATION_TAKEN)
        player = PlayerProfile.objects.get(patient=self.patient)
        self.assertEqual(player.current_streak, 1)

    def test_streak_bonus_at_7_days(self):
        from datetime import date, timedelta
        player, _ = PlayerProfile.objects.get_or_create(patient=self.patient)
        # Simulate 6 previous days
        player.current_streak = 6
        player.longest_streak = 6
        player.last_activity_date = date.today() - timedelta(days=1)
        player.save()
        award_points(self.patient, PointSource.MEDICATION_TAKEN)
        player.refresh_from_db()
        self.assertEqual(player.current_streak, 7)
        # Should have streak bonus transaction
        self.assertTrue(
            PointTransaction.objects.filter(
                player=player, source=PointSource.STREAK_BONUS
            ).exists()
        )

    def test_longest_streak_tracked(self):
        from datetime import date, timedelta
        player, _ = PlayerProfile.objects.get_or_create(patient=self.patient)
        player.current_streak = 14
        player.longest_streak = 14
        player.last_activity_date = date.today() - timedelta(days=2)  # gap
        player.save()
        award_points(self.patient, PointSource.MEDICATION_TAKEN)
        player.refresh_from_db()
        self.assertEqual(player.current_streak, 1)   # reset
        self.assertEqual(player.longest_streak, 14)  # preserved

    def test_streak_bonus_uses_patient_plan_multiplier(self):
        """El bono de racha debe usar el multiplicador del plan real, no FREE fijo."""
        from datetime import date, timedelta
        from apps.payments.models import Plan, Subscription
        plan, _ = Plan.objects.get_or_create(
            tier='SILVER',
            defaults={'name': 'Silver', 'price_mxn': 99, 'max_doctors': 2},
        )
        Subscription.objects.create(user=self.user, plan=plan, status='ACTIVE')

        player, _ = PlayerProfile.objects.get_or_create(patient=self.patient)
        player.current_streak = 6
        player.longest_streak = 6
        player.last_activity_date = date.today() - timedelta(days=1)
        player.save()

        award_points(self.patient, PointSource.MEDICATION_TAKEN)

        bonus = PointTransaction.objects.get(
            player=player, source=PointSource.STREAK_BONUS,
        )
        expected = PLAN_MULTIPLIERS['SILVER']  # 2×
        self.assertEqual(bonus.multiplier, expected)
        self.assertEqual(bonus.points, bonus.base_points * expected)


@pytest.mark.django_db
class TestDuplicatePrevention(TestCase):
    """Restricción unique_points_per_event: sin puntos duplicados por evento."""

    def setUp(self):
        self.user, self.patient = _patient()

    def test_duplicate_event_awarded_once(self):
        # Mismo (player, source, ref_id) dos veces → una sola transacción.
        first = award_points(self.patient, PointSource.MEDICATION_TAKEN, ref_id='evt-123')
        second = award_points(self.patient, PointSource.MEDICATION_TAKEN, ref_id='evt-123')

        self.assertIsNotNone(first)
        self.assertIsNone(second)  # duplicado omitido silenciosamente

        player = PlayerProfile.objects.get(patient=self.patient)
        self.assertEqual(
            PointTransaction.objects.filter(
                player=player, source=PointSource.MEDICATION_TAKEN, ref_id='evt-123'
            ).count(),
            1,
        )
        self.assertEqual(player.total_points, 10)  # no se duplicó (no 20)

    def test_distinct_events_both_awarded(self):
        # ref_id distintos → ambas transacciones se crean.
        award_points(self.patient, PointSource.MEDICATION_TAKEN, ref_id='evt-1')
        award_points(self.patient, PointSource.MEDICATION_TAKEN, ref_id='evt-2')
        player = PlayerProfile.objects.get(patient=self.patient)
        self.assertEqual(
            PointTransaction.objects.filter(player=player).count(), 2
        )

    def test_system_bonus_allows_repeated_empty_ref_id(self):
        # Los bonos del sistema (ref_id='') deben poder repetirse: la
        # restricción parcial los excluye vía condition=~Q(ref_id='').
        player, _ = PlayerProfile.objects.get_or_create(patient=self.patient)
        PointTransaction.objects.create(
            player=player, source=PointSource.STREAK_BONUS,
            base_points=25, multiplier=1, points=25,
        )
        PointTransaction.objects.create(
            player=player, source=PointSource.STREAK_BONUS,
            base_points=25, multiplier=1, points=25,
        )
        self.assertEqual(
            PointTransaction.objects.filter(
                player=player, source=PointSource.STREAK_BONUS, ref_id=''
            ).count(),
            2,
        )


@pytest.mark.django_db
class TestBadges(TestCase):

    def setUp(self):
        self.user, self.patient = _patient()

    def test_badge_awarded_on_first_dose(self):
        _badge('ADHERENCE_1', BadgeCategory.ADHERENCE, threshold=1, reward=20)
        award_points(self.patient, PointSource.MEDICATION_TAKEN)
        player = PlayerProfile.objects.get(patient=self.patient)
        self.assertTrue(
            PlayerBadge.objects.filter(player=player, badge__code='ADHERENCE_1').exists()
        )

    def test_badge_not_awarded_before_threshold(self):
        _badge('ADHERENCE_10', BadgeCategory.ADHERENCE, threshold=10, reward=30)
        award_points(self.patient, PointSource.MEDICATION_TAKEN)
        player = PlayerProfile.objects.get(patient=self.patient)
        self.assertFalse(
            PlayerBadge.objects.filter(player=player, badge__code='ADHERENCE_10').exists()
        )

    def test_badge_not_duplicated(self):
        _badge('ADHERENCE_1', BadgeCategory.ADHERENCE, threshold=1, reward=20)
        award_points(self.patient, PointSource.MEDICATION_TAKEN)
        award_points(self.patient, PointSource.MEDICATION_TAKEN)
        player = PlayerProfile.objects.get(patient=self.patient)
        self.assertEqual(
            PlayerBadge.objects.filter(player=player, badge__code='ADHERENCE_1').count(), 1
        )

    def test_badge_points_reward_added(self):
        _badge('ADHERENCE_1', BadgeCategory.ADHERENCE, threshold=1, reward=20)
        award_points(self.patient, PointSource.MEDICATION_TAKEN)
        player = PlayerProfile.objects.get(patient=self.patient)
        # 10 (MEDICATION_TAKEN) + 20 (badge reward) = 30
        self.assertEqual(player.total_points, 30)

    def test_streak_badge(self):
        from datetime import date, timedelta
        player, _ = PlayerProfile.objects.get_or_create(patient=self.patient)
        player.current_streak = 6
        player.longest_streak = 6
        player.last_activity_date = date.today() - timedelta(days=1)
        player.save()
        _badge('STREAK_7', BadgeCategory.STREAK, threshold=7, reward=50)
        award_points(self.patient, PointSource.MEDICATION_TAKEN)
        player.refresh_from_db()
        self.assertTrue(
            PlayerBadge.objects.filter(player=player, badge__code='STREAK_7').exists()
        )


@pytest.mark.django_db
class TestGamificationAPI(TestCase):

    def setUp(self):
        self.user, self.patient = _patient()
        self.client = _jwt_client(self.user)

    def test_my_profile_empty(self):
        response = self.client.get('/api/v1/gamification/me/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['total_points'], 0)
        self.assertEqual(response.data['level'], 1)

    def test_my_profile_after_points(self):
        award_points(self.patient, PointSource.APPOINTMENT_KEPT)
        response = self.client.get('/api/v1/gamification/me/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreater(response.data['total_points'], 0)

    def test_badge_list(self):
        _badge('TEST_1', BadgeCategory.ADHERENCE, threshold=1)
        response = self.client.get('/api/v1/gamification/badges/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get('results', response.data)
        self.assertGreaterEqual(len(results), 1)

    def test_leaderboard(self):
        award_points(self.patient, PointSource.MEDICATION_TAKEN)
        response = self.client.get('/api/v1/gamification/leaderboard/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get('results', response.data)
        self.assertGreaterEqual(len(results), 1)

    def test_transactions_history(self):
        award_points(self.patient, PointSource.VITAL_LOGGED)
        award_points(self.patient, PointSource.LAB_UPLOADED)
        response = self.client.get('/api/v1/gamification/me/transactions/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get('results', response.data)
        self.assertGreaterEqual(len(results), 2)


@pytest.mark.django_db
class TestRedemptionModel(TestCase):
    """Modelo RedemptionRecord (Actividad 5): defaults, código único, snapshot."""

    def setUp(self):
        self.user, self.patient = _patient()
        self.player, _ = PlayerProfile.objects.get_or_create(patient=self.patient)
        self.reward = RewardProduct.objects.create(
            name='Cupón 10% farmacia', points_cost=100, stock=5, is_active=True,
        )

    def test_create_with_defaults(self):
        rec = RedemptionRecord.objects.create(
            player=self.player, reward=self.reward, points_spent=100,
        )
        self.assertEqual(rec.status, RedemptionRecord.Status.PENDING)
        self.assertTrue(rec.code.startswith('RDM-'))
        self.assertEqual(rec.points_spent, 100)
        self.assertIsNotNone(rec.created_at)

    def test_code_is_autogenerated_and_unique(self):
        rec1 = RedemptionRecord.objects.create(
            player=self.player, reward=self.reward, points_spent=100,
        )
        rec2 = RedemptionRecord.objects.create(
            player=self.player, reward=self.reward, points_spent=100,
        )
        self.assertNotEqual(rec1.code, rec2.code)

    def test_duplicate_code_rejected(self):
        from django.db import IntegrityError, transaction
        RedemptionRecord.objects.create(
            player=self.player, reward=self.reward, points_spent=100, code='RDM-FIXED123',
        )
        with self.assertRaises(IntegrityError), transaction.atomic():
            RedemptionRecord.objects.create(
                player=self.player, reward=self.reward, points_spent=100, code='RDM-FIXED123',
            )

    def test_points_spent_is_snapshot(self):
        rec = RedemptionRecord.objects.create(
            player=self.player, reward=self.reward, points_spent=self.reward.points_cost,
        )
        # El costo de la recompensa cambia después del canje.
        self.reward.points_cost = 250
        self.reward.save(update_fields=['points_cost'])
        rec.refresh_from_db()
        self.assertEqual(rec.points_spent, 100)  # el snapshot no cambia

    def test_reward_protected_from_deletion(self):
        from django.db.models import ProtectedError
        RedemptionRecord.objects.create(
            player=self.player, reward=self.reward, points_spent=100,
        )
        with self.assertRaises(ProtectedError):
            self.reward.delete()
