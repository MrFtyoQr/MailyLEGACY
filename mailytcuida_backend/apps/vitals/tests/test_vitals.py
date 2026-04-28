import pytest
from unittest.mock import patch
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status
from apps.accounts.models import User, PatientProfile, DoctorProfile, DoctorPatient
from apps.vitals.models import VitalSign, VitalGoal


def _create_patient(email='p@test.com', clerk_id='pat_001'):
    user = User.objects.create_user(email=email, clerk_id=clerk_id, role='PATIENT')
    profile = PatientProfile.objects.create(user=user, first_name='Marta', last_name='Ruiz')
    return user, profile


def _create_doctor(email='dr@test.com', clerk_id='doc_001'):
    user = User.objects.create_user(email=email, clerk_id=clerk_id, role='DOCTOR')
    profile = DoctorProfile.objects.create(
        user=user, first_name='Dr', last_name='Smith', license_number='MED-001'
    )
    return user, profile


def _vital(patient, vital_type='HEART_RATE', value='72', recorded_at=None):
    return VitalSign.objects.create(
        patient=patient,
        vital_type=vital_type,
        value=value,
        recorded_at=recorded_at or timezone.now(),
    )


@pytest.mark.django_db
class TestVitalSignCRUD(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user, self.profile = _create_patient()

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    @patch('apps.vitals.views.check_abnormal_vitals')
    def test_create_heart_rate(self, mock_task, mock_verify):
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post('/api/v1/vitals/', {
            'vital_type': 'HEART_RATE',
            'value': '78',
            'recorded_at': timezone.now().isoformat(),
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['unit'], 'bpm')

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    @patch('apps.vitals.views.check_abnormal_vitals')
    def test_create_blood_pressure(self, mock_task, mock_verify):
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post('/api/v1/vitals/', {
            'vital_type': 'BLOOD_PRESSURE',
            'value': '120',
            'secondary_value': '80',
            'recorded_at': timezone.now().isoformat(),
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['unit'], 'mmHg')

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    @patch('apps.vitals.views.check_abnormal_vitals')
    def test_blood_pressure_requires_secondary(self, mock_task, mock_verify):
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post('/api/v1/vitals/', {
            'vital_type': 'BLOOD_PRESSURE',
            'value': '120',
            'recorded_at': timezone.now().isoformat(),
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    @patch('apps.vitals.views.check_abnormal_vitals')
    def test_list_vitals_with_type_filter(self, mock_task, mock_verify):
        _vital(self.profile, 'HEART_RATE', '72')
        _vital(self.profile, 'GLUCOSE', '95')
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get('/api/v1/vitals/?type=HEART_RATE')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    @patch('apps.vitals.views.check_abnormal_vitals')
    def test_delete_vital(self, mock_task, mock_verify):
        v = _vital(self.profile)
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.delete(f'/api/v1/vitals/{v.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(VitalSign.objects.filter(pk=v.id).exists())

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    @patch('apps.vitals.views.check_abnormal_vitals')
    def test_negative_value_rejected(self, mock_task, mock_verify):
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post('/api/v1/vitals/', {
            'vital_type': 'WEIGHT',
            'value': '-5',
            'recorded_at': timezone.now().isoformat(),
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


@pytest.mark.django_db
class TestVitalLatestAndSummary(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user, self.profile = _create_patient()

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_latest_returns_most_recent(self, mock_verify):
        _vital(self.profile, 'HEART_RATE', '70',
               recorded_at=timezone.now() - timezone.timedelta(hours=2))
        _vital(self.profile, 'HEART_RATE', '80',
               recorded_at=timezone.now() - timezone.timedelta(hours=1))
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get('/api/v1/vitals/latest/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        hr = next(r for r in response.data if r['vital_type'] == 'HEART_RATE')
        self.assertEqual(str(hr['value']), '80.00')

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_summary_calculates_stats(self, mock_verify):
        for v in ['60', '70', '80']:
            _vital(self.profile, 'HEART_RATE', v)
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get('/api/v1/vitals/summary/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        hr = next(r for r in response.data if r['vital_type'] == 'HEART_RATE')
        self.assertEqual(hr['count'], 3)
        self.assertEqual(str(hr['avg_value']), '70.00')


@pytest.mark.django_db
class TestVitalGoals(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user, self.profile = _create_patient()

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_create_goal(self, mock_verify):
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post('/api/v1/vitals/goals/', {
            'vital_type': 'HEART_RATE',
            'min_value': '60',
            'max_value': '100',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(VitalGoal.objects.filter(patient=self.profile, vital_type='HEART_RATE').exists())

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_goal_min_must_be_less_than_max(self, mock_verify):
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post('/api/v1/vitals/goals/', {
            'vital_type': 'GLUCOSE',
            'min_value': '200',
            'max_value': '100',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_new_goal_deactivates_old(self, mock_verify):
        VitalGoal.objects.create(
            patient=self.profile, vital_type='WEIGHT',
            set_by=self.user, min_value=50, max_value=80, is_active=True,
        )
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post('/api/v1/vitals/goals/', {
            'vital_type': 'WEIGHT', 'min_value': '55', 'max_value': '85',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        active = VitalGoal.objects.filter(
            patient=self.profile, vital_type='WEIGHT', is_active=True
        )
        self.assertEqual(active.count(), 1)


@pytest.mark.django_db
class TestCheckAbnormalVitals(TestCase):

    def setUp(self):
        self.user, self.profile = _create_patient()

    def test_no_goal_no_alert(self):
        v = _vital(self.profile, 'HEART_RATE', '150')
        from apps.vitals.tasks import check_abnormal_vitals
        # Should complete without error
        check_abnormal_vitals(str(v.pk))

    def test_out_of_range_logs_warning(self):
        v = _vital(self.profile, 'HEART_RATE', '180')
        VitalGoal.objects.create(
            patient=self.profile, vital_type='HEART_RATE',
            set_by=self.user, min_value=60, max_value=100, is_active=True,
        )
        from apps.vitals.tasks import check_abnormal_vitals
        with self.assertLogs('apps.vitals.tasks', level='WARNING') as cm:
            check_abnormal_vitals(str(v.pk))
        self.assertTrue(any('Abnormal vital' in line for line in cm.output))

    def test_in_range_no_warning(self):
        v = _vital(self.profile, 'HEART_RATE', '75')
        VitalGoal.objects.create(
            patient=self.profile, vital_type='HEART_RATE',
            set_by=self.user, min_value=60, max_value=100, is_active=True,
        )
        from apps.vitals.tasks import check_abnormal_vitals
        import logging
        with self.assertLogs('apps.vitals.tasks', level='WARNING') as cm:
            check_abnormal_vitals(str(v.pk))
        # Only INFO logs (alert to patient placeholder), no WARNING
        self.assertFalse(any('Abnormal vital' in line for line in cm.output))


@pytest.mark.django_db
class TestDoctorVitalsView(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.doctor_user, self.doctor = _create_doctor()
        self.patient_user, self.patient = _create_patient()
        DoctorPatient.objects.create(doctor=self.doctor, patient=self.patient, is_active=True)
        _vital(self.patient, 'GLUCOSE', '100')

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_doctor_views_patient_vitals(self, mock_verify):
        mock_verify.return_value = {'sub': 'doc_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get(f'/api/v1/vitals/patient/{self.patient.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_doctor_views_latest_vitals(self, mock_verify):
        mock_verify.return_value = {'sub': 'doc_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get(f'/api/v1/vitals/patient/{self.patient.id}/latest/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_unassigned_doctor_blocked(self, mock_verify):
        other_user, _ = _create_doctor(email='dr2@test.com', clerk_id='doc_002')
        mock_verify.return_value = {'sub': 'doc_002'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get(f'/api/v1/vitals/patient/{self.patient.id}/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
