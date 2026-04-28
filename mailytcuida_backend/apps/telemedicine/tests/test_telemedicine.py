import pytest
from unittest.mock import patch
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status
from apps.accounts.models import User, PatientProfile, DoctorProfile, DoctorPatient
from apps.appointments.models import Appointment
from apps.telemedicine.models import VideoSession, SessionCheckin, SessionNote, SessionStatus


def _patient(email='p@test.com', clerk_id='pat_001'):
    user    = User.objects.create_user(email=email, clerk_id=clerk_id, role='PATIENT')
    profile = PatientProfile.objects.create(user=user, first_name='Iris', last_name='Reyes')
    return user, profile


def _doctor(email='dr@test.com', clerk_id='doc_001'):
    user    = User.objects.create_user(email=email, clerk_id=clerk_id, role='DOCTOR')
    profile = DoctorProfile.objects.create(
        user=user, first_name='Luis', last_name='Medina', license_number='MED-400'
    )
    return user, profile


def _appointment(patient, doctor, appt_type='VIDEO'):
    return Appointment.objects.create(
        patient=patient, doctor=doctor,
        appointment_type=appt_type,
        scheduled_at=timezone.now() + __import__('datetime').timedelta(hours=2),
        status='CONFIRMED',
    )


def _session(appointment, meeting_url='https://zoom.us/j/123'):
    return VideoSession.objects.create(
        appointment=appointment,
        provider='ZOOM',
        meeting_url=meeting_url,
    )


@pytest.mark.django_db
class TestSessionCreation(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.pat_user, self.patient = _patient()
        self.doc_user, self.doctor  = _doctor()
        self.appt = _appointment(self.patient, self.doctor)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_doctor_creates_session(self, mock_verify):
        mock_verify.return_value = {'sub': 'doc_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post('/api/v1/telemedicine/sessions/', {
            'appointment': str(self.appt.id),
            'provider':    'ZOOM',
            'meeting_url': 'https://zoom.us/j/9876543',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(VideoSession.objects.filter(appointment=self.appt).exists())

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_cannot_create_session_for_in_person_appointment(self, mock_verify):
        in_person = _appointment(self.patient, self.doctor, appt_type='IN_PERSON')
        mock_verify.return_value = {'sub': 'doc_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post('/api/v1/telemedicine/sessions/', {
            'appointment': str(in_person.id),
            'provider':    'ZOOM',
            'meeting_url': 'https://zoom.us/j/xxx',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_cannot_duplicate_session(self, mock_verify):
        _session(self.appt)
        mock_verify.return_value = {'sub': 'doc_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post('/api/v1/telemedicine/sessions/', {
            'appointment': str(self.appt.id),
            'provider':    'MEET',
            'meeting_url': 'https://meet.google.com/abc',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


@pytest.mark.django_db
class TestSessionStatusFlow(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.pat_user, self.patient = _patient()
        self.doc_user, self.doctor  = _doctor()
        self.appt    = _appointment(self.patient, self.doctor)
        self.session = _session(self.appt)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_doctor_starts_session(self, mock_verify):
        mock_verify.return_value = {'sub': 'doc_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.patch(
            f'/api/v1/telemedicine/sessions/{self.session.id}/status/',
            {'status': 'IN_PROGRESS'}, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.session.refresh_from_db()
        self.assertEqual(self.session.status, 'IN_PROGRESS')
        self.assertIsNotNone(self.session.started_at)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_doctor_completes_session_calculates_duration(self, mock_verify):
        self.session.status     = 'IN_PROGRESS'
        self.session.started_at = timezone.now() - __import__('datetime').timedelta(minutes=30)
        self.session.save()
        mock_verify.return_value = {'sub': 'doc_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.patch(
            f'/api/v1/telemedicine/sessions/{self.session.id}/status/',
            {'status': 'COMPLETED'}, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.session.refresh_from_db()
        self.assertIsNotNone(self.session.duration_min)
        self.assertGreaterEqual(self.session.duration_min, 29)


@pytest.mark.django_db
class TestPatientCheckin(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.pat_user, self.patient = _patient()
        self.doc_user, self.doctor  = _doctor()
        self.appt    = _appointment(self.patient, self.doctor)
        self.session = _session(self.appt)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_patient_checks_in(self, mock_verify):
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post(
            f'/api/v1/telemedicine/sessions/{self.session.id}/checkin/',
            {'pre_vitals': {'heart_rate': 72}, 'device_info': 'Chrome / macOS'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(SessionCheckin.objects.filter(session=self.session).exists())
        self.session.refresh_from_db()
        self.assertEqual(self.session.status, SessionStatus.WAITING)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_double_checkin_returns_200(self, mock_verify):
        SessionCheckin.objects.create(session=self.session)
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post(
            f'/api/v1/telemedicine/sessions/{self.session.id}/checkin/', {}, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_doctor_polls_checkin(self, mock_verify):
        SessionCheckin.objects.create(session=self.session, pre_vitals={'hr': 80})
        mock_verify.return_value = {'sub': 'doc_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get(
            f'/api/v1/telemedicine/sessions/{self.session.id}/checkin/'
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['checked_in'])


@pytest.mark.django_db
class TestSessionNote(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.pat_user, self.patient = _patient()
        self.doc_user, self.doctor  = _doctor()
        self.appt    = _appointment(self.patient, self.doctor)
        self.session = _session(self.appt)
        self.session.status = SessionStatus.COMPLETED
        self.session.save()

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_doctor_writes_note(self, mock_verify):
        mock_verify.return_value = {'sub': 'doc_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post(
            f'/api/v1/telemedicine/sessions/{self.session.id}/note/',
            {
                'subjective': 'Dolor de cabeza 3 días.',
                'objective':  'PA 130/85.',
                'assessment': 'HTA leve.',
                'plan':       'Ajuste de medicamento.',
            }, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(SessionNote.objects.filter(session=self.session).exists())

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_patient_submits_feedback(self, mock_verify):
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post(
            f'/api/v1/telemedicine/sessions/{self.session.id}/feedback/',
            {'tech_quality': 4, 'patient_rating': 5, 'patient_feedback': 'Muy buena consulta.'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.session.refresh_from_db()
        self.assertEqual(self.session.patient_rating, 5)
        self.assertEqual(self.session.tech_quality, 4)
