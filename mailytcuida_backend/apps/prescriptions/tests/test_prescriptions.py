import pytest
import json
import hashlib
import hmac
from unittest.mock import patch
from django.test import TestCase
from django.conf import settings
from rest_framework.test import APIClient
from rest_framework import status
from apps.accounts.models import User, PatientProfile
from apps.prescriptions.models import Prescription, PrescriptionVerification, PrescriptionStatus


def _patient(email='p@test.com', clerk_id='pat_001'):
    user    = User.objects.create_user(email=email, clerk_id=clerk_id, role='PATIENT')
    profile = PatientProfile.objects.create(user=user, first_name='Elena', last_name='Cruz')
    return user, profile


def _make_signature(body: dict, secret: str = 'test-secret') -> str:
    raw = json.dumps(body, separators=(',', ':')).encode()
    sig = hmac.new(secret.encode(), raw, hashlib.sha256).hexdigest()
    return f'sha256={sig}'


def _webhook_payload(patient_clerk_id='pat_001', ms_id='ms-rx-001'):
    return {
        'mailysoft_prescription_id': ms_id,
        'mailysoft_doctor_id':       'dr-ms-001',
        'mailysoft_clinic_id':       'clinic-ms-001',
        'patient_clerk_id':          patient_clerk_id,
        'doctor_name':               'Dr. Ramírez',
        'doctor_license':            'CDMX-1234',
        'clinic_name':               'Clínica Norte',
        'prescribed_at':             '2026-04-20',
        'expires_at':                '2026-05-20',
        'file_url':                  'https://mailysoft.com/rx/001.pdf',
        'thumbnail_url':             'https://mailysoft.com/rx/001-thumb.jpg',
        'medications': [
            {'name': 'Metformina', 'dose': '500 mg', 'instructions': '1 con desayuno'},
        ],
        'notes':              'Control glucosa.',
        'verification_token': 'tok-abc-123',
        'verification_url':   'https://mailysoft.com/verify/tok-abc-123',
        'signature':          'ms-sig-xyz',
    }


@pytest.mark.django_db
class TestManualUpload(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user, self.patient = _patient()

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_manual_upload_creates_prescription(self, mock_verify):
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post('/api/v1/prescriptions/', {
            'file_url':     'https://r2.example.com/rx.jpg',
            'file_name':    'rx.jpg',
            'mime_type':    'image/jpeg',
            'title':        'Receta cardiólogo',
            'prescribed_by': 'Dr. Hernández',
            'prescribed_at': '2026-04-10',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Prescription.objects.filter(patient=self.patient, source='MANUAL').count(), 1)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_list_prescriptions(self, mock_verify):
        Prescription.objects.create(
            patient=self.patient, source='MANUAL',
            file_url='https://r2.example.com/rx2.jpg',
            title='Rx 1',
        )
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get('/api/v1/prescriptions/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get('results', response.data)
        self.assertGreaterEqual(len(results), 1)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_filter_by_source(self, mock_verify):
        Prescription.objects.create(patient=self.patient, source='MANUAL', file_url='https://r2.example.com/x.jpg')
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get('/api/v1/prescriptions/?source=MAILYSOFT')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get('results', response.data)
        self.assertEqual(len(results), 0)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_soft_delete(self, mock_verify):
        rx = Prescription.objects.create(
            patient=self.patient, source='MANUAL', file_url='https://r2.example.com/r.jpg'
        )
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.delete(f'/api/v1/prescriptions/{rx.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        rx.refresh_from_db()
        self.assertFalse(rx.is_active)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_annotate_prescription(self, mock_verify):
        rx = Prescription.objects.create(
            patient=self.patient, source='MANUAL', file_url='https://r2.example.com/r.jpg'
        )
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.patch(f'/api/v1/prescriptions/{rx.id}/', {
            'title': 'Receta etiquetada', 'status': 'USED',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        rx.refresh_from_db()
        self.assertEqual(rx.title, 'Receta etiquetada')
        self.assertEqual(rx.status, 'USED')


@pytest.mark.django_db
class TestMailySoftWebhook(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user, self.patient = _patient()
        settings.MAILYSOFT_WEBHOOK_SECRET = 'test-secret'

    def _post_webhook(self, payload, secret='test-secret'):
        body     = json.dumps(payload, separators=(',', ':')).encode()
        sig      = 'sha256=' + hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
        return self.client.post(
            '/api/v1/prescriptions/webhook/receive/',
            data=payload, format='json',
            HTTP_X_MAILYSOFT_SIGNATURE=sig,
        )

    def test_webhook_creates_prescription_and_verification(self):
        payload  = _webhook_payload()
        response = self._post_webhook(payload)
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        rx = Prescription.objects.get(mailysoft_id='ms-rx-001')
        self.assertEqual(rx.source, 'MAILYSOFT')
        self.assertEqual(rx.prescribed_by, 'Dr. Ramírez')
        self.assertTrue(hasattr(rx, 'verification'))
        self.assertEqual(rx.verification.token, 'tok-abc-123')
        self.assertTrue(rx.verification.is_valid)

    def test_webhook_idempotent(self):
        payload = _webhook_payload()
        self._post_webhook(payload)
        response = self._post_webhook(payload)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['detail'], 'already_processed')
        self.assertEqual(Prescription.objects.filter(mailysoft_id='ms-rx-001').count(), 1)

    def test_webhook_patient_not_found_returns_404(self):
        payload  = _webhook_payload(patient_clerk_id='nonexistent')
        response = self._post_webhook(payload)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_webhook_bad_signature_rejected(self):
        payload  = _webhook_payload(ms_id='ms-rx-002')
        response = self._post_webhook(payload, secret='wrong-secret')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_webhook_missing_signature_rejected(self):
        payload = _webhook_payload(ms_id='ms-rx-003')
        response = self.client.post(
            '/api/v1/prescriptions/webhook/receive/',
            data=payload, format='json',
            # No signature header
        )
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_revoke_webhook_invalidates_verification(self):
        # First receive
        self._post_webhook(_webhook_payload())
        rx = Prescription.objects.get(mailysoft_id='ms-rx-001')

        # Then revoke
        revoke_payload = {'mailysoft_prescription_id': 'ms-rx-001'}
        body  = json.dumps(revoke_payload, separators=(',', ':')).encode()
        sig   = 'sha256=' + hmac.new(b'test-secret', body, hashlib.sha256).hexdigest()
        response = self.client.post(
            '/api/v1/prescriptions/webhook/revoke/',
            data=revoke_payload, format='json',
            HTTP_X_MAILYSOFT_SIGNATURE=sig,
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        rx.refresh_from_db()
        self.assertEqual(rx.status, PrescriptionStatus.EXPIRED)
        rx.verification.refresh_from_db()
        self.assertFalse(rx.verification.is_valid)
        self.assertIsNotNone(rx.verification.invalidated_at)


@pytest.mark.django_db
class TestPublicVerification(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user, self.patient = _patient()

    def test_verify_valid_token(self):
        rx = Prescription.objects.create(
            patient=self.patient, source='MAILYSOFT',
            mailysoft_id='ms-rx-ver-001',
            prescribed_at='2026-04-01',
            file_url='https://mailysoft.com/rx.pdf',
            status='ACTIVE',
        )
        PrescriptionVerification.objects.create(
            prescription=rx, token='tok-public-001',
            issued_by_name='Dr. García', issued_by_license='LIC-999',
            clinic_name='Clínica Sur', is_valid=True,
        )
        response = self.client.get('/api/v1/prescriptions/verify/tok-public-001/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['is_valid'])
        self.assertEqual(response.data['issued_by_name'], 'Dr. García')

    def test_verify_invalid_token_returns_404(self):
        response = self.client.get('/api/v1/prescriptions/verify/nonexistent/')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
