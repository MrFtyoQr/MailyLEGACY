import pytest
from unittest.mock import patch
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from apps.accounts.models import User, PatientProfile, DoctorProfile, DoctorPatient
from apps.specialists.models import (
    SpecialistProfile, TeamMember, ReferralRequest,
    SpecialistReview, VerificationStatus, ReferralStatus,
)


def _patient(email='p@test.com', clerk_id='pat_001'):
    user    = User.objects.create_user(email=email, clerk_id=clerk_id, role='PATIENT')
    profile = PatientProfile.objects.create(user=user, first_name='Carlos', last_name='Vega')
    return user, profile


def _doctor(email='dr@test.com', clerk_id='doc_001'):
    user    = User.objects.create_user(email=email, clerk_id=clerk_id, role='DOCTOR')
    profile = DoctorProfile.objects.create(
        user=user, first_name='Ana', last_name='Torres', license_number='MED-300'
    )
    return user, profile


def _specialist(name='Dr. Especialista', area='CARDIOLOGY', verified=True):
    sp = SpecialistProfile.objects.create(
        name=name, specialty_area=area, specialist_type='DOCTOR',
        verification_status='VERIFIED' if verified else 'PENDING',
        is_active=True,
    )
    return sp


@pytest.mark.django_db
class TestSpecialistBrowse(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user, self.patient = _patient()

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_list_verified_specialists(self, mock_verify):
        _specialist('Dr. Heart', 'CARDIOLOGY', verified=True)
        _specialist('Dr. Pending', 'NEUROLOGY', verified=False)
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get('/api/v1/specialists/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get('results', response.data)
        names = [r['name'] for r in results]
        self.assertIn('Dr. Heart', names)
        self.assertNotIn('Dr. Pending', names)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_filter_by_specialty(self, mock_verify):
        _specialist('Dr. Heart', 'CARDIOLOGY')
        _specialist('Dr. Brain', 'NEUROLOGY')
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get('/api/v1/specialists/?specialty_area=CARDIOLOGY')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get('results', response.data)
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['name'], 'Dr. Heart')

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_search_by_name(self, mock_verify):
        _specialist('Dr. García Pérez', 'DERMATOLOGY')
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get('/api/v1/specialists/?q=García')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get('results', response.data)
        self.assertGreaterEqual(len(results), 1)


@pytest.mark.django_db
class TestTeamManagement(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.doc_user, self.doctor = _doctor()
        self.sp = _specialist()

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_add_specialist_to_team(self, mock_verify):
        mock_verify.return_value = {'sub': 'doc_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post('/api/v1/specialists/team/', {
            'specialist_id': str(self.sp.id),
            'note': 'Excelente cardiólogo',
        }, format='json')
        self.assertIn(response.status_code, [status.HTTP_200_OK, status.HTTP_201_CREATED])
        self.assertTrue(TeamMember.objects.filter(doctor=self.doctor, specialist=self.sp).exists())

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_list_team(self, mock_verify):
        TeamMember.objects.create(doctor=self.doctor, specialist=self.sp, is_active=True)
        mock_verify.return_value = {'sub': 'doc_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get('/api/v1/specialists/team/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(len(response.data), 1)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_remove_from_team(self, mock_verify):
        member = TeamMember.objects.create(doctor=self.doctor, specialist=self.sp, is_active=True)
        mock_verify.return_value = {'sub': 'doc_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.delete(f'/api/v1/specialists/team/{member.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        member.refresh_from_db()
        self.assertFalse(member.is_active)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_doctor_registers_new_specialist(self, mock_verify):
        mock_verify.return_value = {'sub': 'doc_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post('/api/v1/specialists/register/', {
            'specialist_type': 'LAB',
            'specialty_area':  'LABORATORY',
            'name':            'Laboratorio Central CDMX',
            'city':            'Ciudad de México',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['verification_status'], 'PENDING')
        # Auto-added to team
        sp = SpecialistProfile.objects.get(name='Laboratorio Central CDMX')
        self.assertTrue(TeamMember.objects.filter(doctor=self.doctor, specialist=sp).exists())


@pytest.mark.django_db
class TestReferrals(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.pat_user, self.patient = _patient()
        self.doc_user, self.doctor  = _doctor()
        self.sp = _specialist()
        DoctorPatient.objects.create(doctor=self.doctor, patient=self.patient, is_active=True)
        TeamMember.objects.create(doctor=self.doctor, specialist=self.sp, is_active=True)

    def _create_referral(self, status_val='PENDING'):
        return ReferralRequest.objects.create(
            doctor=self.doctor, patient=self.patient, specialist=self.sp,
            reason='Control cardiológico anual',
            urgency='MEDIUM', status=status_val,
        )

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_doctor_creates_referral(self, mock_verify):
        mock_verify.return_value = {'sub': 'doc_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post('/api/v1/specialists/referrals/', {
            'specialist': str(self.sp.id),
            'patient':    str(self.patient.id),
            'reason':     'Evaluación cardiológica',
            'urgency':    'HIGH',
            'patient_consent': False,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(ReferralRequest.objects.count(), 1)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_referral_requires_assigned_patient(self, mock_verify):
        _, other_patient = _patient(email='p2@test.com', clerk_id='pat_002')
        mock_verify.return_value = {'sub': 'doc_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post('/api/v1/specialists/referrals/', {
            'specialist': str(self.sp.id),
            'patient':    str(other_patient.id),
            'reason':     'Test',
            'urgency':    'LOW',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_referral_requires_team_member(self, mock_verify):
        other_sp = _specialist('Otro Especialista', 'NEUROLOGY')
        mock_verify.return_value = {'sub': 'doc_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post('/api/v1/specialists/referrals/', {
            'specialist': str(other_sp.id),
            'patient':    str(self.patient.id),
            'reason':     'Test',
            'urgency':    'LOW',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_clinical_notes_require_consent(self, mock_verify):
        mock_verify.return_value = {'sub': 'doc_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post('/api/v1/specialists/referrals/', {
            'specialist':     str(self.sp.id),
            'patient':        str(self.patient.id),
            'reason':         'Evaluación',
            'urgency':        'LOW',
            'clinical_notes': 'Paciente con HTA.',
            'patient_consent': False,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_patient_sees_their_referrals(self, mock_verify):
        self._create_referral()
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get('/api/v1/specialists/referrals/mine/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get('results', response.data)
        self.assertGreaterEqual(len(results), 1)


@pytest.mark.django_db
class TestReviews(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.pat_user, self.patient = _patient()
        self.doc_user, self.doctor  = _doctor()
        self.sp = _specialist()
        DoctorPatient.objects.create(doctor=self.doctor, patient=self.patient, is_active=True)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_patient_reviews_completed_referral(self, mock_verify):
        referral = ReferralRequest.objects.create(
            doctor=self.doctor, patient=self.patient, specialist=self.sp,
            reason='Test', status=ReferralStatus.COMPLETED,
        )
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post(f'/api/v1/specialists/referrals/{referral.id}/review/', {
            'referral': str(referral.id),
            'rating':   5,
            'comment':  'Excelente atención.',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(SpecialistReview.objects.filter(specialist=self.sp).exists())

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_cannot_review_pending_referral(self, mock_verify):
        referral = ReferralRequest.objects.create(
            doctor=self.doctor, patient=self.patient, specialist=self.sp,
            reason='Test', status=ReferralStatus.PENDING,
        )
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post(f'/api/v1/specialists/referrals/{referral.id}/review/', {
            'referral': str(referral.id),
            'rating':   4,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_list_public_reviews(self, mock_verify):
        referral = ReferralRequest.objects.create(
            doctor=self.doctor, patient=self.patient, specialist=self.sp,
            reason='Test', status=ReferralStatus.COMPLETED,
        )
        SpecialistReview.objects.create(
            referral=referral, patient=self.patient, specialist=self.sp,
            rating=4, comment='Muy bien.', is_public=True,
        )
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get(f'/api/v1/specialists/{self.sp.id}/reviews/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get('results', response.data)
        self.assertEqual(len(results), 1)
