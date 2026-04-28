import pytest
from unittest.mock import patch
from django.test import TestCase
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIClient
from rest_framework import status
from apps.accounts.models import User, PatientProfile
from apps.coupons.models import Coupon, CouponRedemption, DiscountType
from apps.coupons.service import validate_coupon, redeem_coupon, CouponError


def _user(email='u@test.com', clerk_id='u_001', role='PATIENT'):
    return User.objects.create_user(email=email, clerk_id=clerk_id, role=role)


def _coupon(**kwargs):
    defaults = dict(
        code='TEST20', discount_type=DiscountType.PERCENT,
        discount_value=20, is_active=True, max_uses_per_user=1,
    )
    defaults.update(kwargs)
    return Coupon.objects.create(**defaults)


@pytest.mark.django_db
class TestCouponValidation(TestCase):

    def setUp(self):
        self.user = _user()

    def test_valid_coupon(self):
        coupon = _coupon()
        result = validate_coupon('TEST20', self.user, 'SILVER')
        self.assertEqual(result.id, coupon.id)

    def test_case_insensitive(self):
        _coupon()
        result = validate_coupon('test20', self.user, 'SILVER')
        self.assertIsNotNone(result)

    def test_inactive_coupon_rejected(self):
        _coupon(is_active=False)
        with self.assertRaises(CouponError):
            validate_coupon('TEST20', self.user, 'SILVER')

    def test_expired_coupon_rejected(self):
        _coupon(valid_until=timezone.now() - timedelta(days=1))
        with self.assertRaises(CouponError):
            validate_coupon('TEST20', self.user, 'SILVER')

    def test_not_yet_valid_rejected(self):
        _coupon(valid_from=timezone.now() + timedelta(days=5))
        with self.assertRaises(CouponError):
            validate_coupon('TEST20', self.user, 'SILVER')

    def test_exhausted_coupon_rejected(self):
        coupon = _coupon(max_uses=1, uses_count=1)
        with self.assertRaises(CouponError):
            validate_coupon('TEST20', self.user, 'SILVER')

    def test_wrong_plan_rejected(self):
        _coupon(allowed_plans=['GOLD', 'PLATINUM'])
        with self.assertRaises(CouponError):
            validate_coupon('TEST20', self.user, 'SILVER')

    def test_per_user_limit_enforced(self):
        coupon = _coupon(max_uses_per_user=1)
        CouponRedemption.objects.create(
            coupon=coupon, user=self.user,
            discount_type=DiscountType.PERCENT, discount_value=20,
        )
        with self.assertRaises(CouponError):
            validate_coupon('TEST20', self.user, 'SILVER')

    def test_first_time_only_blocks_existing_subscriber(self):
        from apps.payments.models import Plan, Subscription
        plan, _ = Plan.objects.get_or_create(
            tier='SILVER', defaults={'name': 'Silver', 'price_mxn': 99, 'max_doctors': 2}
        )
        Subscription.objects.create(user=self.user, plan=plan, status='ACTIVE')
        _coupon(first_time_only=True)
        with self.assertRaises(CouponError):
            validate_coupon('TEST20', self.user, 'SILVER')

    def test_redemption_increments_count(self):
        coupon = _coupon()
        redeem_coupon(coupon, self.user, stripe_session_id='cs_test_123')
        coupon.refresh_from_db()
        self.assertEqual(coupon.uses_count, 1)
        self.assertTrue(CouponRedemption.objects.filter(
            coupon=coupon, user=self.user
        ).exists())


@pytest.mark.django_db
class TestCouponAPI(TestCase):

    def setUp(self):
        self.client     = APIClient()
        self.user       = _user()
        self.admin_user = _user(email='a@test.com', clerk_id='adm_001', role='ADMIN')

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_admin_creates_coupon(self, mock_verify):
        mock_verify.return_value = {'sub': 'adm_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post('/api/v1/coupons/', {
            'code':           'WELCOME30',
            'discount_type':  'PERCENT',
            'discount_value': 30,
            'description':    '30% de descuento en primer mes',
            'max_uses':       500,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Coupon.objects.filter(code='WELCOME30').exists())

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_patient_cannot_create_coupon(self, mock_verify):
        mock_verify.return_value = {'sub': 'u_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post('/api/v1/coupons/', {
            'code': 'HACK', 'discount_type': 'PERCENT', 'discount_value': 100,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_validate_valid_coupon(self, mock_verify):
        _coupon(code='VALID20')
        mock_verify.return_value = {'sub': 'u_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post('/api/v1/coupons/validate/', {
            'code': 'VALID20', 'plan_tier': 'SILVER',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['valid'])
        self.assertEqual(str(response.data['discount_value']), '20.00')

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_validate_invalid_coupon_returns_error(self, mock_verify):
        mock_verify.return_value = {'sub': 'u_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post('/api/v1/coupons/validate/', {
            'code': 'NONEXISTENT', 'plan_tier': 'SILVER',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['valid'])
        self.assertNotEqual(response.data['error'], '')

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_my_redemptions(self, mock_verify):
        coupon = _coupon()
        redeem_coupon(coupon, self.user, stripe_session_id='cs_test_001')
        mock_verify.return_value = {'sub': 'u_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get('/api/v1/coupons/my-redemptions/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get('results', response.data)
        self.assertGreaterEqual(len(results), 1)
