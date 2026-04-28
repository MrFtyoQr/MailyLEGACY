import pytest
from unittest.mock import patch
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status
from apps.accounts.models import User, PatientProfile, DoctorProfile, DoctorPatient
from apps.lab_results.models import LabPanel, LabResult, LabRec


def _create_patient(email='p@test.com', clerk_id='pat_001'):
    user = User.objects.create_user(email=email, clerk_id=clerk_id, role='PATIENT')
    profile = PatientProfile.objects.create(user=user, first_name='Sofía', last_name='Méndez')
    return user, profile


def _create_doctor(email='dr@test.com', clerk_id='doc_001'):
    user = User.objects.create_user(email=email, clerk_id=clerk_id, role='DOCTOR')
    profile = DoctorProfile.objects.create(
        user=user, first_name='Dr', last_name='Ramírez', license_number='MED-002'
    )
    return user, profile


def _panel(patient, name='Química 24'):
    return LabPanel.objects.create(
        patient=patient, panel_name=name,
        lab_name='Laboratorio Chopo',
        performed_at='2026-04-01',
    )


def _result(patient, panel=None, param='Triglicéridos', value='250',
             ref_min=None, ref_max=None):
    return LabResult.objects.create(
        patient=patient, panel=panel,
        parameter=param, value=value, unit='mg/dL',
        ref_min=ref_min, ref_max=ref_max,
        performed_at='2026-04-01',
    )


@pytest.mark.django_db
class TestLabPanelCRUD(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user, self.profile = _create_patient()

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_create_panel(self, mock_verify):
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post('/api/v1/labs/', {
            'panel_name': 'Biometría hemática',
            'lab_name': 'Salud Digna',
            'performed_at': '2026-04-10',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(LabPanel.objects.filter(patient=self.profile).exists())

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_list_panels(self, mock_verify):
        _panel(self.profile)
        _panel(self.profile, name='Perfil tiroideo')
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get('/api/v1/labs/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 2)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_delete_panel_removes_results(self, mock_verify):
        panel = _panel(self.profile)
        _result(self.profile, panel=panel)
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.delete(f'/api/v1/labs/{panel.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(LabResult.objects.filter(panel=panel).exists())


@pytest.mark.django_db
class TestIndividualLabResult(TestCase):
    """Individual saving without a panel — core requirement."""

    def setUp(self):
        self.client = APIClient()
        self.user, self.profile = _create_patient()

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    @patch('apps.lab_results.views.generate_lab_recommendations')
    def test_save_single_result_without_panel(self, mock_task, mock_verify):
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post('/api/v1/labs/results/', {
            'parameter': 'Triglicéridos',
            'value': '180',
            'unit': 'mg/dL',
            'performed_at': '2026-04-15',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIsNone(response.data['panel'])

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    @patch('apps.lab_results.views.generate_lab_recommendations')
    def test_save_only_weight_no_other_fields_required(self, mock_task, mock_verify):
        """Key test: patient can save just one value — no panel, no refs required."""
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post('/api/v1/labs/results/', {
            'parameter': 'Hemoglobina',
            'value': '14.5',
            'unit': 'g/dL',
            'performed_at': '2026-04-15',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        r = LabResult.objects.get(pk=response.data['id'])
        self.assertEqual(r.status, LabResult.Status.UNKNOWN)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    @patch('apps.lab_results.views.generate_lab_recommendations')
    def test_negative_value_rejected(self, mock_task, mock_verify):
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post('/api/v1/labs/results/', {
            'parameter': 'Glucosa',
            'value': '-10',
            'unit': 'mg/dL',
            'performed_at': '2026-04-15',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    @patch('apps.lab_results.views.generate_lab_recommendations')
    def test_filter_by_parameter(self, mock_task, mock_verify):
        _result(self.profile, param='Glucosa', value='95')
        _result(self.profile, param='Creatinina', value='0.9')
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get('/api/v1/labs/results/?param=gluco')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)


@pytest.mark.django_db
class TestLabResultStatus(TestCase):

    def setUp(self):
        self.user, self.profile = _create_patient()

    def test_status_normal_within_range(self):
        r = _result(self.profile, value='150', ref_min='0', ref_max='200')
        self.assertEqual(r.status, LabResult.Status.NORMAL)

    def test_status_abnormal_high(self):
        r = _result(self.profile, value='250', ref_min='0', ref_max='200')
        self.assertEqual(r.status, LabResult.Status.ABNORMAL_HIGH)

    def test_status_abnormal_low(self):
        r = _result(self.profile, value='5', ref_min='12', ref_max='17')
        self.assertEqual(r.status, LabResult.Status.ABNORMAL_LOW)

    def test_status_critical_severely_high(self):
        # 600 vs max 200 → 200% over → CRITICAL
        r = _result(self.profile, value='600', ref_min='0', ref_max='200')
        self.assertEqual(r.status, LabResult.Status.CRITICAL)

    def test_status_unknown_no_refs(self):
        r = _result(self.profile, value='100')
        self.assertEqual(r.status, LabResult.Status.UNKNOWN)


@pytest.mark.django_db
class TestLabRecommendations(TestCase):

    def setUp(self):
        self.user, self.profile = _create_patient()

    def test_recommendations_generated_for_abnormal(self):
        r = _result(self.profile, param='Triglicéridos', value='500', ref_min='0', ref_max='150')
        from apps.lab_results.tasks import generate_lab_recommendations
        generate_lab_recommendations(str(r.pk))
        self.assertGreater(LabRec.objects.filter(result=r).count(), 0)

    def test_no_recommendations_for_normal(self):
        r = _result(self.profile, param='Triglicéridos', value='100', ref_min='0', ref_max='150')
        from apps.lab_results.tasks import generate_lab_recommendations
        generate_lab_recommendations(str(r.pk))
        self.assertEqual(LabRec.objects.filter(result=r).count(), 0)

    def test_no_recommendations_without_refs(self):
        r = _result(self.profile, param='Triglicéridos', value='500')
        from apps.lab_results.tasks import generate_lab_recommendations
        generate_lab_recommendations(str(r.pk))
        self.assertEqual(LabRec.objects.filter(result=r).count(), 0)


@pytest.mark.django_db
class TestLabSummary(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user, self.profile = _create_patient()

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_summary_shows_latest_per_parameter(self, mock_verify):
        LabResult.objects.create(
            patient=self.profile, parameter='Glucosa', value='90',
            unit='mg/dL', performed_at='2026-03-01',
        )
        LabResult.objects.create(
            patient=self.profile, parameter='Glucosa', value='105',
            unit='mg/dL', performed_at='2026-04-01',
        )
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get('/api/v1/labs/summary/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        glucosa = next(r for r in response.data if r['parameter'] == 'Glucosa')
        self.assertEqual(str(glucosa['value']), '105.000')


@pytest.mark.django_db
class TestDoctorLabViews(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.doctor_user, self.doctor = _create_doctor()
        self.patient_user, self.patient = _create_patient()
        DoctorPatient.objects.create(doctor=self.doctor, patient=self.patient, is_active=True)
        _panel(self.patient)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_doctor_views_patient_labs(self, mock_verify):
        mock_verify.return_value = {'sub': 'doc_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get(f'/api/v1/labs/patient/{self.patient.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_unassigned_doctor_blocked(self, mock_verify):
        other_user, _ = _create_doctor(email='dr2@test.com', clerk_id='doc_002')
        mock_verify.return_value = {'sub': 'doc_002'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get(f'/api/v1/labs/patient/{self.patient.id}/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
