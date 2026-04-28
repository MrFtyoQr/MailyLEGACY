import pytest
from unittest.mock import patch
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from apps.accounts.models import User, PatientProfile, DoctorProfile, DoctorPatient
from apps.medications.models import (
    Medication, MedicationPattern, MedicationSchedule, MealSchedule,
)


def _create_patient(email='p@test.com', clerk_id='pat_001'):
    user = User.objects.create_user(email=email, clerk_id=clerk_id, role='PATIENT')
    profile = PatientProfile.objects.create(user=user, first_name='Ana', last_name='López')
    return user, profile


def _create_doctor(email='dr@test.com', clerk_id='doc_001'):
    user = User.objects.create_user(email=email, clerk_id=clerk_id, role='DOCTOR')
    profile = DoctorProfile.objects.create(
        user=user, first_name='Dr', last_name='House', license_number='MED-001'
    )
    return user, profile


@pytest.mark.django_db
class TestMedicationCRUD(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user, self.profile = _create_patient()

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_create_medication(self, mock_verify):
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post('/api/v1/medications/', {
            'name': 'Metformina', 'dosage': '500', 'unit': 'mg',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Medication.objects.filter(patient=self.profile, name='Metformina').exists())

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_list_medications(self, mock_verify):
        Medication.objects.create(patient=self.profile, name='Med A')
        Medication.objects.create(patient=self.profile, name='Med B')
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get('/api/v1/medications/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 2)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_soft_delete_medication(self, mock_verify):
        med = Medication.objects.create(patient=self.profile, name='Aspirina')
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.delete(f'/api/v1/medications/{med.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        med.refresh_from_db()
        self.assertFalse(med.is_active)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_patch_medication(self, mock_verify):
        med = Medication.objects.create(patient=self.profile, name='Ibuprofeno')
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.patch(
            f'/api/v1/medications/{med.id}/', {'dosage': '400', 'unit': 'mg'}, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        med.refresh_from_db()
        self.assertEqual(med.dosage, '400')


@pytest.mark.django_db
class TestMedicationPattern(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user, self.profile = _create_patient()
        self.med = Medication.objects.create(patient=self.profile, name='Losartán')

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_create_daily_pattern(self, mock_verify):
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post(
            f'/api/v1/medications/{self.med.id}/patterns/',
            {'pattern_type': 'DAILY'}, format='json'
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_specific_days_requires_days_list(self, mock_verify):
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post(
            f'/api/v1/medications/{self.med.id}/patterns/',
            {'pattern_type': 'SPECIFIC_DAYS', 'specific_days_of_week': []},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_create_specific_days_pattern(self, mock_verify):
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post(
            f'/api/v1/medications/{self.med.id}/patterns/',
            {'pattern_type': 'SPECIFIC_DAYS', 'specific_days_of_week': [0, 2, 4]},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_invalid_day_in_specific_days(self, mock_verify):
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post(
            f'/api/v1/medications/{self.med.id}/patterns/',
            {'pattern_type': 'SPECIFIC_DAYS', 'specific_days_of_week': [7]},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


@pytest.mark.django_db
class TestMedicationSchedule(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user, self.profile = _create_patient()
        self.med = Medication.objects.create(patient=self.profile, name='Omeprazol')

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_create_schedule(self, mock_verify):
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post(
            f'/api/v1/medications/{self.med.id}/schedules/',
            {'time': '08:00:00', 'reminder_minutes_before': 15},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_relative_schedule_requires_meal_type(self, mock_verify):
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post(
            f'/api/v1/medications/{self.med.id}/schedules/',
            {'time': '08:00:00', 'is_relative_to_meal': True},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


@pytest.mark.django_db
class TestMealSchedule(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user, self.profile = _create_patient()

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_create_meal_schedule(self, mock_verify):
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post(
            '/api/v1/meal-schedules/',
            {'meal_type': 'BREAKFAST', 'time': '07:30:00'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(MealSchedule.objects.filter(patient=self.profile).exists())

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_list_meal_schedules(self, mock_verify):
        MealSchedule.objects.create(patient=self.profile, meal_type='BREAKFAST', time='07:30')
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get('/api/v1/meal-schedules/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)


@pytest.mark.django_db
class TestDoctorPatientMedicationsView(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.doctor_user, self.doctor = _create_doctor()
        self.patient_user, self.patient = _create_patient()
        DoctorPatient.objects.create(doctor=self.doctor, patient=self.patient, is_active=True)
        Medication.objects.create(patient=self.patient, name='Atorvastatina')

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_doctor_views_patient_medications(self, mock_verify):
        mock_verify.return_value = {'sub': 'doc_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get(f'/api/v1/medications/patient/{self.patient.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_unassigned_doctor_cannot_view(self, mock_verify):
        other_doc_user, _ = _create_doctor(email='dr2@test.com', clerk_id='doc_002')
        mock_verify.return_value = {'sub': 'doc_002'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get(f'/api/v1/medications/patient/{self.patient.id}/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
