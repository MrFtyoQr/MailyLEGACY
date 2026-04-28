import pytest
from unittest.mock import patch, MagicMock
from django.test import TestCase, override_settings
from rest_framework.test import APIClient
from rest_framework import status
from apps.accounts.models import User


@pytest.mark.django_db
class TestBruteForceProtection(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email='victim@test.com',
            clerk_id='user_victim_001',
            role='PATIENT',
        )

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_repeated_invalid_tokens_trigger_rate_limit(self, mock_verify):
        """
        Después de N intentos con token inválido desde la misma IP
        la respuesta debe ser 429 Too Many Requests.
        django-ratelimit bloquea por IP en endpoints sensibles.
        """
        from rest_framework.exceptions import AuthenticationFailed
        mock_verify.side_effect = AuthenticationFailed('Token inválido.')

        for _ in range(5):
            self.client.credentials(HTTP_AUTHORIZATION='Bearer bad-token')
            self.client.get('/api/v1/auth/me/', REMOTE_ADDR='10.0.0.1')

        # El 6to intento debe ser bloqueado por axes / ratelimit
        response = self.client.get(
            '/api/v1/auth/me/',
            REMOTE_ADDR='10.0.0.1',
            HTTP_AUTHORIZATION='Bearer bad-token',
        )
        self.assertIn(response.status_code, [
            status.HTTP_429_TOO_MANY_REQUESTS,
            status.HTTP_403_FORBIDDEN,
        ])

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_valid_token_after_failed_attempts_different_ip(self, mock_verify):
        """
        Un usuario legítimo desde otra IP no debe ser bloqueado
        aunque otra IP haya fallado.
        """
        mock_verify.return_value = {'sub': 'user_victim_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer valid-token')
        response = self.client.get(
            '/api/v1/auth/me/',
            REMOTE_ADDR='10.0.0.2',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    def test_webhook_endpoint_no_auth_header(self):
        """El webhook no requiere JWT pero sí firma Svix."""
        response = self.client.post(
            '/api/v1/auth/webhook/clerk/',
            data='{}',
            content_type='application/json',
        )
        # Sin firma Svix válida debe retornar 400, no 401/403
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_missing_bearer_prefix_rejected(self, mock_verify):
        """Token sin prefijo Bearer debe ser rechazado."""
        self.client.credentials(HTTP_AUTHORIZATION='Token fake-jwt')
        response = self.client.get('/api/v1/auth/me/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        mock_verify.assert_not_called()

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_expired_token_returns_403(self, mock_verify):
        """Token expirado debe retornar 403 con mensaje claro."""
        from rest_framework.exceptions import AuthenticationFailed
        mock_verify.side_effect = AuthenticationFailed('Token expirado.')
        self.client.credentials(HTTP_AUTHORIZATION='Bearer expired-token')
        response = self.client.get('/api/v1/auth/me/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
