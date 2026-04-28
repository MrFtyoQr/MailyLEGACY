import pytest
from unittest.mock import patch
from django.test import TestCase
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIClient
from rest_framework import status
from apps.accounts.models import User, PatientProfile, DoctorProfile, DoctorPatient
from apps.appointments.models import Appointment, AppointmentNote


def _create_patient(email='p@test.com', clerk_id='pat_001'):
    user = User.objects.create_user(email=email, clerk_id=clerk_id, role='PATIENT')
    profile = PatientProfile.objects.create(user=user, first_name='Elena', last_name='Vega')
    return user, profile


def _create_doctor(email='dr@test.com', clerk_id='doc_001'):
    user = User.objects.create_user(email=email, clerk_id=clerk_id, role='DOCTOR')
    profile = DoctorProfile.objects.create(
        user=user, first_name='Jorge', last_name='Castillo', license_number='MED-010'
    )
    return user, profile


def _future(hours=48):
    return timezone.now() + timedelta(hours=hours)


def _past(hours=2):
    return timezone.now() - timedelta(hours=hours)


def _appt(patient, doctor, scheduled_at=None, appt_status=Appointment.Status.PENDING,
          appt_type=Appointment.AppointmentType.IN_PERSON):
    return Appointment.objects.create(
        patient=patient, doctor=doctor,
        appointment_type=appt_type,
        status=appt_status,
        scheduled_at=scheduled_at or _future(),
        location='Clínica Central',
    )


@pytest.mark.django_db
class TestPatientCreatesAppointment(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user, self.patient = _create_patient()
        self.doctor_user, self.doctor = _create_doctor()

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    @patch('apps.appointments.views._schedule_reminders')
    def test_patient_creates_in_person_appointment(self, mock_remind, mock_verify):
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post('/api/v1/appointments/', {
            'doctor': str(self.doctor.id),
            'appointment_type': 'IN_PERSON',
            'scheduled_at': _future(48).isoformat(),
            'location': 'Clínica Sur 123',
            'reason': 'Revisión anual',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], 'PENDING')
        mock_remind.assert_called_once()

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    @patch('apps.appointments.views._schedule_reminders')
    def test_in_person_requires_location(self, mock_remind, mock_verify):
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post('/api/v1/appointments/', {
            'doctor': str(self.doctor.id),
            'appointment_type': 'IN_PERSON',
            'scheduled_at': _future(48).isoformat(),
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    @patch('apps.appointments.views._schedule_reminders')
    def test_past_date_rejected(self, mock_remind, mock_verify):
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post('/api/v1/appointments/', {
            'doctor': str(self.doctor.id),
            'appointment_type': 'IN_PERSON',
            'scheduled_at': _past(1).isoformat(),
            'location': 'Clínica',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_list_patient_appointments(self, mock_verify):
        _appt(self.patient, self.doctor)
        _appt(self.patient, self.doctor)
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get('/api/v1/appointments/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 2)


@pytest.mark.django_db
class TestPatientCancels(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user, self.patient = _create_patient()
        self.doctor_user, self.doctor = _create_doctor()

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_patient_cancels_pending(self, mock_verify):
        appt = _appt(self.patient, self.doctor)
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post(f'/api/v1/appointments/{appt.id}/cancel/', {
            'reason': 'Me siento mejor'
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        appt.refresh_from_db()
        self.assertEqual(appt.status, Appointment.Status.CANCELLED)
        self.assertEqual(appt.cancelled_by, self.user)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_cannot_cancel_completed(self, mock_verify):
        appt = _appt(self.patient, self.doctor, appt_status=Appointment.Status.COMPLETED)
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post(f'/api/v1/appointments/{appt.id}/cancel/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


@pytest.mark.django_db
class TestDoctorFlow(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.patient_user, self.patient = _create_patient()
        self.doctor_user, self.doctor = _create_doctor()

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_doctor_confirms_appointment(self, mock_verify):
        appt = _appt(self.patient, self.doctor)
        mock_verify.return_value = {'sub': 'doc_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post(f'/api/v1/appointments/{appt.id}/confirm/', {
            'video_link': 'https://meet.google.com/abc-xyz',
            'notes': 'Traer análisis recientes',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        appt.refresh_from_db()
        self.assertEqual(appt.status, Appointment.Status.CONFIRMED)
        self.assertEqual(appt.video_link, 'https://meet.google.com/abc-xyz')

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_doctor_completes_appointment(self, mock_verify):
        appt = _appt(self.patient, self.doctor, appt_status=Appointment.Status.CONFIRMED)
        mock_verify.return_value = {'sub': 'doc_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post(f'/api/v1/appointments/{appt.id}/complete/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        appt.refresh_from_db()
        self.assertEqual(appt.status, Appointment.Status.COMPLETED)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    @patch('apps.appointments.views._schedule_reminders')
    def test_doctor_reschedules_appointment(self, mock_remind, mock_verify):
        appt = _appt(self.patient, self.doctor, appt_status=Appointment.Status.CONFIRMED)
        mock_verify.return_value = {'sub': 'doc_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        new_dt = _future(72).isoformat()
        response = self.client.patch(f'/api/v1/appointments/{appt.id}/reschedule/', {
            'scheduled_at': new_dt,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        appt.refresh_from_db()
        self.assertEqual(appt.status, Appointment.Status.RESCHEDULED)
        new_appt = Appointment.objects.get(pk=response.data['id'])
        self.assertEqual(new_appt.status, Appointment.Status.CONFIRMED)
        mock_remind.assert_called_once_with(new_appt)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_doctor_lists_own_appointments(self, mock_verify):
        _appt(self.patient, self.doctor)
        mock_verify.return_value = {'sub': 'doc_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get('/api/v1/appointments/doctor/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)


@pytest.mark.django_db
class TestClinicalNotes(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.patient_user, self.patient = _create_patient()
        self.doctor_user, self.doctor = _create_doctor()

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_doctor_adds_clinical_note(self, mock_verify):
        appt = _appt(self.patient, self.doctor, appt_status=Appointment.Status.COMPLETED)
        mock_verify.return_value = {'sub': 'doc_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post(f'/api/v1/appointments/{appt.id}/notes/', {
            'chief_complaint': 'Dolor de cabeza',
            'diagnosis': 'Migraña tensional',
            'treatment_plan': 'Ibuprofeno 400mg cada 8h por 3 días',
            'follow_up_days': 7,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(AppointmentNote.objects.filter(appointment=appt).exists())

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_notes_require_completed_status(self, mock_verify):
        appt = _appt(self.patient, self.doctor, appt_status=Appointment.Status.CONFIRMED)
        mock_verify.return_value = {'sub': 'doc_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post(f'/api/v1/appointments/{appt.id}/notes/', {
            'diagnosis': 'Algo'
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


@pytest.mark.django_db
class TestNoShow(TestCase):

    def setUp(self):
        self.patient_user, self.patient = _create_patient()
        self.doctor_user, self.doctor = _create_doctor()

    def test_missed_appointment_marked_no_show(self):
        _appt(self.patient, self.doctor,
              scheduled_at=_past(2),
              appt_status=Appointment.Status.CONFIRMED)
        from apps.appointments.tasks import check_missed_appointments
        count = check_missed_appointments()
        self.assertEqual(count, 1)
        appt = Appointment.objects.first()
        self.assertEqual(appt.status, Appointment.Status.NO_SHOW)

    def test_future_appointment_not_marked_no_show(self):
        _appt(self.patient, self.doctor,
              scheduled_at=_future(2),
              appt_status=Appointment.Status.CONFIRMED)
        from apps.appointments.tasks import check_missed_appointments
        count = check_missed_appointments()
        self.assertEqual(count, 0)
