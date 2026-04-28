import json
import pytest
from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIClient
from rest_framework import status
from apps.accounts.models import User
from apps.payments.models import Plan, Subscription, PaymentEvent


def _user(email='u@test.com', clerk_id='usr_001', role='PATIENT'):
    return User.objects.create_user(email=email, clerk_id=clerk_id, role=role)


def _plan(tier='SILVER', price=99):
    return Plan.objects.get_or_create(
        tier=tier,
        defaults={'name': tier.capitalize(), 'price_mxn': price,
                  'stripe_price_id': f'price_{tier.lower()}', 'max_doctors': 2},
    )[0]


def _free_plan():
    return Plan.objects.get_or_create(
        tier='FREE',
        defaults={'name': 'Gratuito', 'price_mxn': 0, 'max_doctors': 1},
    )[0]


def _subscription(user, plan, sub_status=Subscription.Status.ACTIVE,
                  stripe_sub_id='sub_test_123', stripe_cust_id='cus_test_456'):
    return Subscription.objects.create(
        user=user, plan=plan, status=sub_status,
        stripe_subscription_id=stripe_sub_id,
        stripe_customer_id=stripe_cust_id,
    )


@pytest.mark.django_db
class TestPlanList(TestCase):

    def setUp(self):
        self.client = APIClient()
        _free_plan()
        _plan('SILVER', 99)
        _plan('GOLD', 249)

    def test_plan_list_public(self):
        response = self.client.get('/api/v1/payments/plans/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 3)

    def test_plans_ordered_by_price(self):
        response = self.client.get('/api/v1/payments/plans/')
        prices = [p['price_mxn'] for p in response.data]
        self.assertEqual(prices, sorted(prices))


@pytest.mark.django_db
class TestSubscriptionView(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user = _user()
        _free_plan()

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_auto_creates_free_subscription(self, mock_verify):
        mock_verify.return_value = {'sub': 'usr_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get('/api/v1/payments/subscription/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['tier'], 'FREE')
        self.assertTrue(Subscription.objects.filter(user=self.user).exists())

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_returns_existing_subscription(self, mock_verify):
        plan = _plan('GOLD', 249)
        _subscription(self.user, plan)
        mock_verify.return_value = {'sub': 'usr_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get('/api/v1/payments/subscription/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['tier'], 'GOLD')


@pytest.mark.django_db
class TestCheckout(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user = _user()
        _plan('SILVER', 99)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    @patch('apps.payments.views._get_or_create_stripe_customer', return_value='cus_xyz')
    @patch('stripe.checkout.Session.create')
    def test_checkout_returns_url(self, mock_session, mock_customer, mock_verify):
        mock_session.return_value = MagicMock(url='https://checkout.stripe.com/test')
        mock_verify.return_value = {'sub': 'usr_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post('/api/v1/payments/checkout/', {
            'tier': 'SILVER',
            'success_url': 'https://app.example.com/success',
            'cancel_url':  'https://app.example.com/cancel',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('checkout_url', response.data)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_checkout_invalid_tier_rejected(self, mock_verify):
        mock_verify.return_value = {'sub': 'usr_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post('/api/v1/payments/checkout/', {
            'tier': 'FREE',
            'success_url': 'https://app.example.com/success',
            'cancel_url':  'https://app.example.com/cancel',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


@pytest.mark.django_db
class TestCancel(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user = _user()

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    @patch('stripe.Subscription.modify')
    def test_cancel_at_period_end(self, mock_modify, mock_verify):
        plan = _plan('GOLD', 249)
        _subscription(self.user, plan)
        mock_verify.return_value = {'sub': 'usr_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post('/api/v1/payments/cancel/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['cancel_at_period_end'])
        mock_modify.assert_called_once()

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_cannot_cancel_free_plan(self, mock_verify):
        free = _free_plan()
        _subscription(self.user, free, stripe_sub_id='', stripe_cust_id='')
        mock_verify.return_value = {'sub': 'usr_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post('/api/v1/payments/cancel/')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


@pytest.mark.django_db
class TestWebhook(TestCase):

    def setUp(self):
        self.client = APIClient()

    @patch('stripe.Webhook.construct_event')
    @patch('apps.payments.tasks.process_stripe_event.delay')
    def test_valid_webhook_accepted(self, mock_task, mock_event):
        mock_event.return_value = {
            'id': 'evt_test_001',
            'type': 'invoice.payment_succeeded',
            'data': {'object': {'subscription': 'sub_abc'}},
        }
        response = self.client.post(
            '/api/v1/payments/webhook/',
            data=b'{}',
            content_type='application/json',
            HTTP_STRIPE_SIGNATURE='t=1,v1=sig',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(PaymentEvent.objects.filter(stripe_event_id='evt_test_001').exists())
        mock_task.assert_called_once()

    @patch('stripe.Webhook.construct_event', side_effect=Exception('bad sig'))
    def test_invalid_signature_rejected(self, mock_event):
        response = self.client.post(
            '/api/v1/payments/webhook/',
            data=b'{}',
            content_type='application/json',
            HTTP_STRIPE_SIGNATURE='invalid',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch('stripe.Webhook.construct_event')
    @patch('apps.payments.tasks.process_stripe_event.delay')
    def test_duplicate_event_ignored(self, mock_task, mock_event):
        PaymentEvent.objects.create(
            stripe_event_id='evt_dup', event_type='test', payload={}, processed=True
        )
        mock_event.return_value = {
            'id': 'evt_dup', 'type': 'test',
            'data': {'object': {}},
        }
        response = self.client.post(
            '/api/v1/payments/webhook/',
            data=b'{}',
            content_type='application/json',
            HTTP_STRIPE_SIGNATURE='t=1,v1=sig',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        mock_task.assert_not_called()


@pytest.mark.django_db
class TestDowngradeTask(TestCase):

    def setUp(self):
        self.user = _user()

    def test_past_due_over_7_days_downgraded(self):
        plan = _plan('GOLD', 249)
        sub  = _subscription(self.user, plan, sub_status=Subscription.Status.PAST_DUE)
        sub.past_due_since = timezone.now() - timedelta(days=8)
        sub.save(update_fields=['past_due_since'])

        from apps.payments.tasks import downgrade_expired_subscriptions
        count = downgrade_expired_subscriptions()
        self.assertEqual(count, 1)
        sub.refresh_from_db()
        self.assertEqual(sub.plan.tier, 'FREE')
        self.assertEqual(sub.status, Subscription.Status.CANCELLED)

    def test_past_due_under_7_days_not_downgraded(self):
        plan = _plan('SILVER', 99)
        sub  = _subscription(self.user, plan, sub_status=Subscription.Status.PAST_DUE)
        sub.past_due_since = timezone.now() - timedelta(days=3)
        sub.save(update_fields=['past_due_since'])

        from apps.payments.tasks import downgrade_expired_subscriptions
        count = downgrade_expired_subscriptions()
        self.assertEqual(count, 0)
        sub.refresh_from_db()
        self.assertEqual(sub.plan.tier, 'SILVER')
