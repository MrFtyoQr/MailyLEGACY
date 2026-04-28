import pytest
from unittest.mock import patch, MagicMock
from django.test import TestCase, RequestFactory
from rest_framework.test import APIClient
from rest_framework import status
from apps.accounts.models import User, PatientProfile


@pytest.mark.django_db
class TestClerkJWTAuthentication(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email='paciente@test.com',
            clerk_id='user_test_123',
            role='PATIENT',
        )

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_me_endpoint_authenticated(self, mock_verify):
        mock_verify.return_value = {'sub': 'user_test_123'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake-jwt-token')
        response = self.client.get('/api/v1/auth/me/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['email'], 'paciente@test.com')
        self.assertEqual(response.data['role'], 'PATIENT')

    def test_me_endpoint_unauthenticated(self):
        response = self.client.get('/api/v1/auth/me/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_me_endpoint_invalid_token(self, mock_verify):
        from rest_framework.exceptions import AuthenticationFailed
        mock_verify.side_effect = AuthenticationFailed('Token inválido.')
        self.client.credentials(HTTP_AUTHORIZATION='Bearer invalid-token')
        response = self.client.get('/api/v1/auth/me/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_role_endpoint_returns_permissions(self, mock_verify):
        mock_verify.return_value = {'sub': 'user_test_123'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake-jwt-token')
        response = self.client.get('/api/v1/auth/me/role/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['role'], 'PATIENT')
        self.assertIn('read:own_vitals', response.data['permissions'])

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_doctor_role_has_correct_permissions(self, mock_verify):
        doctor = User.objects.create_user(
            email='doctor@test.com',
            clerk_id='user_doctor_456',
            role='DOCTOR',
        )
        mock_verify.return_value = {'sub': 'user_doctor_456'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake-jwt-token')
        response = self.client.get('/api/v1/auth/me/role/')
        self.assertIn('read:patients', response.data['permissions'])
        self.assertIn('read:analytics', response.data['permissions'])

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_inactive_user_blocked(self, mock_verify):
        self.user.is_active = False
        self.user.save()
        mock_verify.return_value = {'sub': 'user_test_123'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake-jwt-token')
        response = self.client.get('/api/v1/auth/me/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


@pytest.mark.django_db
class TestClerkWebhook(TestCase):

    def setUp(self):
        self.client = APIClient()

    @patch('apps.accounts.webhooks.clerk_webhooks.Webhook')
    def test_webhook_creates_patient_user(self, mock_webhook_class):
        mock_wh = MagicMock()
        mock_wh.verify.return_value = {
            'type': 'user.created',
            'data': {
                'id': 'user_new_789',
                'email_addresses': [{'id': 'ea_1', 'email_address': 'nuevo@test.com'}],
                'primary_email_address_id': 'ea_1',
                'first_name': 'Juan',
                'last_name': 'Pérez',
                'phone_numbers': [],
                'public_metadata': {'role': 'patient'},
            }
        }
        mock_webhook_class.return_value = mock_wh

        response = self.client.post(
            '/api/v1/auth/webhook/clerk/',
            data='{}',
            content_type='application/json',
            HTTP_SVIX_ID='msg_1',
            HTTP_SVIX_TIMESTAMP='1234567890',
            HTTP_SVIX_SIGNATURE='v1,abc123',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(User.objects.filter(clerk_id='user_new_789').exists())
        self.assertTrue(PatientProfile.objects.filter(
            user__clerk_id='user_new_789'
        ).exists())

    @patch('apps.accounts.webhooks.clerk_webhooks.Webhook')
    def test_webhook_invalid_signature_returns_400(self, mock_webhook_class):
        from svix.webhooks import WebhookVerificationError
        mock_wh = MagicMock()
        mock_wh.verify.side_effect = WebhookVerificationError()
        mock_webhook_class.return_value = mock_wh

        response = self.client.post(
            '/api/v1/auth/webhook/clerk/',
            data='{}',
            content_type='application/json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
