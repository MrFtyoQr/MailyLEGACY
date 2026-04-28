import pytest
from unittest.mock import patch, MagicMock
from io import BytesIO
from PIL import Image
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from apps.accounts.models import User, PatientProfile, DoctorProfile, DoctorPatient


def _make_image(fmt='JPEG') -> BytesIO:
    buf = BytesIO()
    Image.new('RGB', (100, 100), color='red').save(buf, format=fmt)
    buf.seek(0)
    buf.name = f'test.{"jpg" if fmt == "JPEG" else fmt.lower()}'
    buf.content_type = f'image/{"jpeg" if fmt == "JPEG" else fmt.lower()}'
    return buf


def _auth(client, clerk_id):
    with patch('apps.accounts.middleware.clerk_auth._verify_clerk_token') as m:
        m.return_value = {'sub': clerk_id}
        client.credentials(HTTP_AUTHORIZATION='Bearer fake-token')
    return m


@pytest.mark.django_db
class TestPatientProfile(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email='paciente@test.com', clerk_id='patient_001', role='PATIENT'
        )

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_get_creates_profile_if_missing(self, mock_verify):
        mock_verify.return_value = {'sub': 'patient_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get('/api/v1/auth/profiles/patient/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(PatientProfile.objects.filter(user=self.user).exists())

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_patch_updates_profile(self, mock_verify):
        PatientProfile.objects.create(user=self.user, first_name='Juan', last_name='López')
        mock_verify.return_value = {'sub': 'patient_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.patch(
            '/api/v1/auth/profiles/patient/',
            {'first_name': 'Carlos', 'blood_type': 'O+'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.user.patient_profile.refresh_from_db()
        self.assertEqual(self.user.patient_profile.first_name, 'Carlos')
        self.assertEqual(self.user.patient_profile.blood_type, 'O+')

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_invalid_blood_type_rejected(self, mock_verify):
        PatientProfile.objects.create(user=self.user, first_name='x', last_name='y')
        mock_verify.return_value = {'sub': 'patient_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.patch(
            '/api/v1/auth/profiles/patient/',
            {'blood_type': 'Z+'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_doctor_cannot_access_patient_profile_endpoint(self, mock_verify):
        doctor = User.objects.create_user(
            email='dr@test.com', clerk_id='doctor_999', role='DOCTOR'
        )
        mock_verify.return_value = {'sub': 'doctor_999'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get('/api/v1/auth/profiles/patient/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


@pytest.mark.django_db
class TestDoctorProfile(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.doctor_user = User.objects.create_user(
            email='doctor@test.com', clerk_id='doctor_001', role='DOCTOR'
        )
        self.doctor_profile = DoctorProfile.objects.create(
            user=self.doctor_user,
            first_name='Ana', last_name='García',
            license_number='MED-12345',
        )

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_doctor_gets_own_profile(self, mock_verify):
        mock_verify.return_value = {'sub': 'doctor_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get('/api/v1/auth/profiles/doctor/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['license_number'], 'MED-12345')

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_short_license_rejected(self, mock_verify):
        mock_verify.return_value = {'sub': 'doctor_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.patch(
            '/api/v1/auth/profiles/doctor/',
            {'license_number': 'AB'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


@pytest.mark.django_db
class TestDoctorPatientAssignment(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.doctor_user = User.objects.create_user(
            email='doctor@test.com', clerk_id='doctor_001', role='DOCTOR'
        )
        self.doctor_profile = DoctorProfile.objects.create(
            user=self.doctor_user, first_name='Ana', last_name='García',
            license_number='MED-001',
        )
        self.patient_user = User.objects.create_user(
            email='paciente@test.com', clerk_id='patient_001', role='PATIENT'
        )
        self.patient_profile = PatientProfile.objects.create(
            user=self.patient_user, first_name='Luis', last_name='Ramos'
        )

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_doctor_assigns_patient_by_email(self, mock_verify):
        mock_verify.return_value = {'sub': 'doctor_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post(
            '/api/v1/auth/doctor/patients/',
            {'patient_email': 'paciente@test.com'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(DoctorPatient.objects.filter(
            doctor=self.doctor_profile, patient=self.patient_profile, is_active=True
        ).exists())

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_assign_nonexistent_email_returns_400(self, mock_verify):
        mock_verify.return_value = {'sub': 'doctor_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post(
            '/api/v1/auth/doctor/patients/',
            {'patient_email': 'noexiste@test.com'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_doctor_lists_own_patients(self, mock_verify):
        DoctorPatient.objects.create(
            doctor=self.doctor_profile, patient=self.patient_profile, is_active=True
        )
        mock_verify.return_value = {'sub': 'doctor_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get('/api/v1/auth/doctor/patients/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data['results']), 1)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_doctor_unassigns_patient(self, mock_verify):
        assignment = DoctorPatient.objects.create(
            doctor=self.doctor_profile, patient=self.patient_profile, is_active=True
        )
        mock_verify.return_value = {'sub': 'doctor_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.delete(f'/api/v1/auth/doctor/patients/{assignment.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        assignment.refresh_from_db()
        self.assertFalse(assignment.is_active)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_patient_cannot_access_doctor_patients_endpoint(self, mock_verify):
        mock_verify.return_value = {'sub': 'patient_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get('/api/v1/auth/doctor/patients/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


@pytest.mark.django_db
class TestPhotoUpload(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email='foto@test.com', clerk_id='photo_001', role='PATIENT'
        )
        PatientProfile.objects.create(user=self.user, first_name='Foto', last_name='Test')

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    @patch('apps.accounts.views._upload_photo')
    def test_upload_photo_updates_url(self, mock_upload, mock_verify):
        mock_verify.return_value = {'sub': 'photo_001'}
        mock_upload.return_value = 'https://r2.example.com/patients/abc.jpg'
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        img = _make_image()
        response = self.client.post(
            '/api/v1/auth/profiles/patient/photo/',
            {'photo': img},
            format='multipart',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('photo_url', response.data)
        self.user.patient_profile.refresh_from_db()
        self.assertEqual(self.user.patient_profile.photo_url, 'https://r2.example.com/patients/abc.jpg')
