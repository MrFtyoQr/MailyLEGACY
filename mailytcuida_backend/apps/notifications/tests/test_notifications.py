import pytest
from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIClient
from rest_framework import status
from apps.accounts.models import User
from apps.notifications.models import DeviceToken, Notification


def _create_user(email='u@test.com', clerk_id='user_001', role='PATIENT'):
    return User.objects.create_user(email=email, clerk_id=clerk_id, role=role)


def _notif(user, code='WELCOME', notif_status=Notification.Status.SENT,
           channel=Notification.Channel.IN_APP):
    return Notification.objects.create(
        user=user, code=code, channel=channel,
        title='Test', body='Test body', status=notif_status,
    )


@pytest.mark.django_db
class TestNotificationList(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user = _create_user()

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_list_own_notifications(self, mock_verify):
        _notif(self.user)
        _notif(self.user, code='APPOINTMENT_CONFIRMED')
        mock_verify.return_value = {'sub': 'user_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get('/api/v1/notifications/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 2)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_filter_unread(self, mock_verify):
        _notif(self.user, notif_status=Notification.Status.SENT)
        _notif(self.user, notif_status=Notification.Status.READ)
        mock_verify.return_value = {'sub': 'user_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get('/api/v1/notifications/?unread=1')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_unread_count(self, mock_verify):
        _notif(self.user, notif_status=Notification.Status.SENT)
        _notif(self.user, notif_status=Notification.Status.SENT)
        _notif(self.user, notif_status=Notification.Status.READ)
        mock_verify.return_value = {'sub': 'user_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get('/api/v1/notifications/unread-count/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['unread'], 2)


@pytest.mark.django_db
class TestMarkRead(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user = _create_user()

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_mark_single_read(self, mock_verify):
        notif = _notif(self.user, notif_status=Notification.Status.SENT)
        mock_verify.return_value = {'sub': 'user_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post(f'/api/v1/notifications/{notif.id}/read/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        notif.refresh_from_db()
        self.assertEqual(notif.status, Notification.Status.READ)
        self.assertIsNotNone(notif.read_at)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_mark_all_read(self, mock_verify):
        for _ in range(3):
            _notif(self.user, notif_status=Notification.Status.SENT)
        mock_verify.return_value = {'sub': 'user_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post('/api/v1/notifications/read-all/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['marked_read'], 3)
        self.assertEqual(
            Notification.objects.filter(user=self.user, status=Notification.Status.READ).count(), 3
        )


@pytest.mark.django_db
class TestDeviceToken(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user = _create_user()

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_register_token(self, mock_verify):
        mock_verify.return_value = {'sub': 'user_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post('/api/v1/notifications/device-token/', {
            'token': 'fcm-token-abc123',
            'platform': 'ANDROID',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(DeviceToken.objects.filter(user=self.user, token='fcm-token-abc123').exists())

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_reregister_same_token_upserts(self, mock_verify):
        DeviceToken.objects.create(user=self.user, token='fcm-xyz', platform='ANDROID', is_active=False)
        mock_verify.return_value = {'sub': 'user_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post('/api/v1/notifications/device-token/', {
            'token': 'fcm-xyz',
            'platform': 'ANDROID',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(DeviceToken.objects.filter(user=self.user, token='fcm-xyz').count(), 1)
        self.assertTrue(DeviceToken.objects.get(user=self.user, token='fcm-xyz').is_active)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_delete_token_deactivates(self, mock_verify):
        token = DeviceToken.objects.create(
            user=self.user, token='fcm-del', platform='IOS', is_active=True
        )
        mock_verify.return_value = {'sub': 'user_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.delete(f'/api/v1/notifications/device-token/{token.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        token.refresh_from_db()
        self.assertFalse(token.is_active)


@pytest.mark.django_db
class TestDispatchTask(TestCase):

    def setUp(self):
        self.user = _create_user()

    @patch('apps.notifications.service.send_push', return_value=True)
    def test_dispatch_push_success(self, mock_push):
        notif = Notification.objects.create(
            user=self.user, code='WELCOME', channel='PUSH',
            title='Test', body='Body', status=Notification.Status.PENDING,
        )
        from apps.notifications.tasks import dispatch_notification
        dispatch_notification(str(notif.pk))
        notif.refresh_from_db()
        self.assertEqual(notif.status, Notification.Status.SENT)
        self.assertIsNotNone(notif.sent_at)
        mock_push.assert_called_once()

    @patch('apps.notifications.service.send_push', return_value=False)
    def test_dispatch_push_failure_retries(self, mock_push):
        notif = Notification.objects.create(
            user=self.user, code='WELCOME', channel='PUSH',
            title='Test', body='Body', status=Notification.Status.PENDING,
        )
        from apps.notifications.tasks import dispatch_notification
        from celery.exceptions import Retry
        with self.assertRaises(Retry):
            dispatch_notification(str(notif.pk))

    def test_dispatch_inapp_always_succeeds(self):
        notif = Notification.objects.create(
            user=self.user, code='WELCOME', channel='IN_APP',
            title='Test', body='Body', status=Notification.Status.PENDING,
        )
        from apps.notifications.tasks import dispatch_notification
        dispatch_notification(str(notif.pk))
        notif.refresh_from_db()
        self.assertEqual(notif.status, Notification.Status.SENT)


@pytest.mark.django_db
class TestNotifyService(TestCase):

    def setUp(self):
        self.user = _create_user()

    @patch('apps.notifications.tasks.dispatch_notification.delay')
    def test_notify_creates_record_and_enqueues(self, mock_delay):
        from apps.notifications.service import notify
        notify(self.user, 'WELCOME', context={'first_name': 'Ana'})
        notif = Notification.objects.get(user=self.user, code='WELCOME')
        self.assertIn('Ana', notif.body)
        mock_delay.assert_called_once_with(str(notif.pk))

    @patch('apps.notifications.tasks.dispatch_notification.delay')
    def test_notify_unknown_code_does_nothing(self, mock_delay):
        from apps.notifications.service import notify
        notify(self.user, 'NONEXISTENT_CODE')
        self.assertEqual(Notification.objects.count(), 0)
        mock_delay.assert_not_called()


@pytest.mark.django_db
class TestStaleCleanup(TestCase):

    def setUp(self):
        self.user = _create_user()

    def test_stale_pending_marked_failed(self):
        old = Notification.objects.create(
            user=self.user, code='WELCOME', channel='IN_APP',
            title='T', body='B', status=Notification.Status.PENDING,
        )
        old.created_at = timezone.now() - timedelta(hours=25)
        old.save(update_fields=['created_at'])
        from apps.notifications.tasks import mark_stale_notifications_failed
        count = mark_stale_notifications_failed()
        self.assertEqual(count, 1)
        old.refresh_from_db()
        self.assertEqual(old.status, Notification.Status.FAILED)
