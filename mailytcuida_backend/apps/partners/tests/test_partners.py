import pytest
from unittest.mock import patch
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status
from apps.accounts.models import User, PatientProfile
from apps.partners.models import (
    PartnerOrganization, PartnerAdmin, MemberEnrollment,
    PartnerHealthSnapshot, PartnerStatus,
)


def _patient(email='p@test.com', clerk_id='pat_001'):
    user    = User.objects.create_user(email=email, clerk_id=clerk_id, role='PATIENT')
    profile = PatientProfile.objects.create(user=user, first_name='Mario', last_name='Ortiz')
    return user, profile


def _admin_user(email='admin@test.com', clerk_id='adm_001'):
    return User.objects.create_user(email=email, clerk_id=clerk_id, role='ADMIN')


def _partner_user(email='partner@test.com', clerk_id='par_001'):
    return User.objects.create_user(email=email, clerk_id=clerk_id, role='PARTNER')


def _org(name='Empresa Test'):
    return PartnerOrganization.objects.create(
        name=name, status=PartnerStatus.ACTIVE, max_members=50
    )


@pytest.mark.django_db
class TestOrganizationManagement(TestCase):

    def setUp(self):
        self.client     = APIClient()
        self.admin_user = _admin_user()

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_admin_creates_organization(self, mock_verify):
        mock_verify.return_value = {'sub': 'adm_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post('/api/v1/partners/organizations/', {
            'name':         'Corporativo CDMX',
            'max_members':  200,
            'monthly_fee_mxn': 5000,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(PartnerOrganization.objects.filter(name='Corporativo CDMX').exists())

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_non_admin_cannot_create_organization(self, mock_verify):
        _, patient = _patient()
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post('/api/v1/partners/organizations/', {
            'name': 'Intento', 'max_members': 10,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_admin_lists_organizations(self, mock_verify):
        _org('Org A')
        _org('Org B')
        mock_verify.return_value = {'sub': 'adm_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get('/api/v1/partners/organizations/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get('results', response.data)
        self.assertGreaterEqual(len(results), 2)


@pytest.mark.django_db
class TestEnrollment(TestCase):

    def setUp(self):
        self.client     = APIClient()
        self.admin_user = _admin_user()
        self.user, self.patient = _patient()
        self.org = _org()

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_admin_enrolls_patient(self, mock_verify):
        mock_verify.return_value = {'sub': 'adm_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post(
            f'/api/v1/partners/organizations/{self.org.id}/enroll/',
            {'patient_id': str(self.patient.id), 'employee_id': 'EMP-001'},
            format='json',
        )
        self.assertIn(response.status_code, [status.HTTP_200_OK, status.HTTP_201_CREATED])
        self.assertTrue(MemberEnrollment.objects.filter(
            organization=self.org, patient=self.patient
        ).exists())

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_seat_limit_enforced(self, mock_verify):
        self.org.max_members = 1
        self.org.save()
        # Fill the one seat
        _, p2 = _patient(email='p2@test.com', clerk_id='pat_002')
        MemberEnrollment.objects.create(organization=self.org, patient=p2, is_active=True)

        mock_verify.return_value = {'sub': 'adm_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post(
            f'/api/v1/partners/organizations/{self.org.id}/enroll/',
            {'patient_id': str(self.patient.id)},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_patient_grants_consent(self, mock_verify):
        enrollment = MemberEnrollment.objects.create(
            organization=self.org, patient=self.patient, is_active=True, consent=False
        )
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post(
            f'/api/v1/partners/my-enrollments/{enrollment.id}/consent/',
            {'consent': True}, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['consent'])
        enrollment.refresh_from_db()
        self.assertTrue(enrollment.consent)
        self.assertIsNotNone(enrollment.consent_at)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_patient_revokes_consent(self, mock_verify):
        enrollment = MemberEnrollment.objects.create(
            organization=self.org, patient=self.patient,
            is_active=True, consent=True, consent_at=timezone.now()
        )
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post(
            f'/api/v1/partners/my-enrollments/{enrollment.id}/consent/',
            {'consent': False}, format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        enrollment.refresh_from_db()
        self.assertFalse(enrollment.consent)
        self.assertIsNone(enrollment.consent_at)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_patient_sees_own_enrollments(self, mock_verify):
        MemberEnrollment.objects.create(
            organization=self.org, patient=self.patient, is_active=True
        )
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get('/api/v1/partners/my-enrollments/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get('results', response.data)
        self.assertGreaterEqual(len(results), 1)


@pytest.mark.django_db
class TestPartnerDashboard(TestCase):

    def setUp(self):
        self.client       = APIClient()
        self.partner_user = _partner_user()
        self.org          = _org()
        PartnerAdmin.objects.create(organization=self.org, user=self.partner_user)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_partner_sees_dashboard(self, mock_verify):
        mock_verify.return_value = {'sub': 'par_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get('/api/v1/partners/dashboard/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('organization', response.data)
        self.assertIn('consenting_count', response.data)
        self.assertIn('seats_available', response.data)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_snapshot_suppressed_when_small_cohort(self, mock_verify):
        from datetime import date, timedelta
        snap = PartnerHealthSnapshot.objects.create(
            organization=self.org,
            period_start=date.today() - timedelta(days=7),
            period_end=date.today(),
            consenting_members=5,  # < MIN_COHORT (10)
            avg_adherence_pct=80,
        )
        self.assertTrue(snap.is_suppressed)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_snapshot_not_suppressed_with_enough_members(self, mock_verify):
        from datetime import date, timedelta
        snap = PartnerHealthSnapshot.objects.create(
            organization=self.org,
            period_start=date.today() - timedelta(days=7),
            period_end=date.today(),
            consenting_members=15,
            avg_adherence_pct=85,
        )
        self.assertFalse(snap.is_suppressed)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_member_list_anonymized_for_partner(self, mock_verify):
        _, patient = _patient()
        MemberEnrollment.objects.create(
            organization=self.org, patient=patient, is_active=True, consent=True
        )
        mock_verify.return_value = {'sub': 'par_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get('/api/v1/partners/members/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get('results', response.data)
        # Name must not be the real name
        for m in results:
            self.assertNotIn('Mario', m.get('patient_name', ''))
