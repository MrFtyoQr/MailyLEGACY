import pytest
from unittest.mock import patch
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status
from apps.accounts.models import User, PatientProfile
from apps.medications.models import Medication, MedicationHistory


def _create_patient(email='p@test.com', clerk_id='pat_001'):
    user = User.objects.create_user(email=email, clerk_id=clerk_id, role='PATIENT')
    profile = PatientProfile.objects.create(user=user, first_name='Luis', last_name='Torres')
    return user, profile


def _pending_entry(patient, med, delta_hours=1):
    return MedicationHistory.objects.create(
        patient=patient,
        medication=med,
        medication_name=med.name,
        scheduled_at=timezone.now() + timezone.timedelta(hours=delta_hours),
        status=MedicationHistory.Status.PENDING,
    )


@pytest.mark.django_db
class TestHistoryActions(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user, self.profile = _create_patient()
        self.med = Medication.objects.create(patient=self.profile, name='Paracetamol')

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_take_entry(self, mock_verify):
        entry = _pending_entry(self.profile, self.med)
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post(
            f'/api/v1/medications/history/{entry.id}/take/',
            {'dosage_taken': '500 mg', 'notes': 'Bien'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        entry.refresh_from_db()
        self.assertEqual(entry.status, MedicationHistory.Status.TAKEN)
        self.assertIsNotNone(entry.actual_taken_at)
        self.assertEqual(entry.dosage_taken, '500 mg')

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_skip_entry(self, mock_verify):
        entry = _pending_entry(self.profile, self.med)
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post(
            f'/api/v1/medications/history/{entry.id}/skip/',
            {'notes': 'Olvidé'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        entry.refresh_from_db()
        self.assertEqual(entry.status, MedicationHistory.Status.SKIPPED)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_postpone_entry(self, mock_verify):
        entry = _pending_entry(self.profile, self.med)
        original_at = entry.scheduled_at
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post(
            f'/api/v1/medications/history/{entry.id}/postpone/',
            {'minutes': 30},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        entry.refresh_from_db()
        self.assertEqual(entry.status, MedicationHistory.Status.POSTPONED)
        diff = (entry.scheduled_at - original_at).total_seconds()
        self.assertAlmostEqual(diff, 30 * 60, delta=5)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_cannot_take_already_taken(self, mock_verify):
        entry = _pending_entry(self.profile, self.med)
        entry.status = MedicationHistory.Status.TAKEN
        entry.save()
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post(f'/api/v1/medications/history/{entry.id}/take/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_postpone_requires_minutes(self, mock_verify):
        entry = _pending_entry(self.profile, self.med)
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post(
            f'/api/v1/medications/history/{entry.id}/postpone/', {}, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


@pytest.mark.django_db
class TestHistoryList(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user, self.profile = _create_patient()
        self.med = Medication.objects.create(patient=self.profile, name='Vitamina D')

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_history_list_paginated(self, mock_verify):
        for i in range(5):
            _pending_entry(self.profile, self.med, delta_hours=i)
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get('/api/v1/medications/history/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 5)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_history_today(self, mock_verify):
        today = timezone.now()
        MedicationHistory.objects.create(
            patient=self.profile, medication=self.med,
            medication_name=self.med.name,
            scheduled_at=today,
            status=MedicationHistory.Status.PENDING,
        )
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get('/api/v1/medications/history/today/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 1)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_history_date_filter(self, mock_verify):
        from datetime import date
        past = timezone.now() - timezone.timedelta(days=10)
        MedicationHistory.objects.create(
            patient=self.profile, medication=self.med,
            medication_name=self.med.name, scheduled_at=past,
            status=MedicationHistory.Status.TAKEN,
        )
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        from_str = (timezone.localdate() - timezone.timedelta(days=15)).isoformat()
        to_str   = (timezone.localdate() - timezone.timedelta(days=5)).isoformat()
        response = self.client.get(f'/api/v1/medications/history/?from={from_str}&to={to_str}')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)
