import pytest
from unittest.mock import patch
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from apps.accounts.models import User, PatientProfile
from apps.gamification.models import (
    PlayerProfile, PointTransaction, Badge, PlayerBadge,
    BadgeCategory, PointSource, PLAN_MULTIPLIERS,
)
from apps.gamification.engine import award_points


def _patient(email='p@test.com', clerk_id='pat_001'):
    user    = User.objects.create_user(email=email, clerk_id=clerk_id, role='PATIENT')
    profile = PatientProfile.objects.create(user=user, first_name='Sofía', last_name='Luna')
    return user, profile


def _badge(code='TEST_BADGE', category=BadgeCategory.ADHERENCE, threshold=1, reward=10):
    return Badge.objects.create(
        code=code, name=code, category=category,
        threshold=threshold, points_reward=reward, is_active=True,
    )


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
        self.client = APIClient()
        self.user, self.patient = _patient()

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_my_profile_empty(self, mock_verify):
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get('/api/v1/gamification/me/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['total_points'], 0)
        self.assertEqual(response.data['level'], 1)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_my_profile_after_points(self, mock_verify):
        award_points(self.patient, PointSource.APPOINTMENT_KEPT)
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get('/api/v1/gamification/me/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreater(response.data['total_points'], 0)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_badge_list(self, mock_verify):
        _badge('TEST_1', BadgeCategory.ADHERENCE, threshold=1)
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get('/api/v1/gamification/badges/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get('results', response.data)
        self.assertGreaterEqual(len(results), 1)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_leaderboard(self, mock_verify):
        award_points(self.patient, PointSource.MEDICATION_TAKEN)
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get('/api/v1/gamification/leaderboard/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get('results', response.data)
        self.assertGreaterEqual(len(results), 1)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_transactions_history(self, mock_verify):
        award_points(self.patient, PointSource.VITAL_LOGGED)
        award_points(self.patient, PointSource.LAB_UPLOADED)
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get('/api/v1/gamification/me/transactions/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get('results', response.data)
        self.assertGreaterEqual(len(results), 2)
