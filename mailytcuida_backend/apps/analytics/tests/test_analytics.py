import pytest
from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.utils import timezone
from datetime import timedelta
from rest_framework.test import APIClient
from rest_framework import status
from apps.accounts.models import User, PatientProfile, DoctorProfile, DoctorPatient
from apps.medications.models import Medication, MedicationHistory
from apps.analytics.models import AdherenceReport, HealthInsight


def _patient(email='p@test.com', clerk_id='pat_001'):
    user = User.objects.create_user(email=email, clerk_id=clerk_id, role='PATIENT')
    profile = PatientProfile.objects.create(user=user, first_name='Lucía', last_name='Mora')
    return user, profile


def _doctor(email='dr@test.com', clerk_id='doc_001'):
    user = User.objects.create_user(email=email, clerk_id=clerk_id, role='DOCTOR')
    profile = DoctorProfile.objects.create(
        user=user, first_name='Pedro', last_name='Soto', license_number='MED-030'
    )
    return user, profile


def _med(patient, name='Metformina'):
    return Medication.objects.create(patient=patient, name=name, is_active=True)


def _history(patient, med, hist_status='TAKEN', hours_ago=2):
    return MedicationHistory.objects.create(
        patient=patient, medication=med,
        medication_name=med.name,
        scheduled_at=timezone.now() - timedelta(hours=hours_ago),
        status=hist_status,
    )


@pytest.mark.django_db
class TestAdherenceEngine(TestCase):

    def setUp(self):
        self.user, self.patient = _patient()
        self.med = _med(self.patient)

    def test_perfect_adherence(self):
        for i in range(5):
            _history(self.patient, self.med, 'TAKEN', hours_ago=i * 8)
        from apps.analytics.engine import calculate_adherence
        result = calculate_adherence(self.patient, days=7)
        self.assertEqual(result['taken'], 5)
        self.assertEqual(result['adherence_pct'], 100.0)

    def test_partial_adherence(self):
        for i in range(3):
            _history(self.patient, self.med, 'TAKEN',   hours_ago=i * 8)
        for i in range(2):
            _history(self.patient, self.med, 'SKIPPED', hours_ago=(i + 3) * 8)
        from apps.analytics.engine import calculate_adherence
        result = calculate_adherence(self.patient, days=7)
        self.assertEqual(result['total'], 5)
        self.assertEqual(result['adherence_pct'], 60.0)

    def test_no_doses_returns_zero(self):
        from apps.analytics.engine import calculate_adherence
        result = calculate_adherence(self.patient, days=7)
        self.assertEqual(result['total'], 0)
        self.assertEqual(result['adherence_pct'], 0)

    def test_per_medication_breakdown(self):
        med2 = _med(self.patient, 'Losartán')
        _history(self.patient, self.med,  'TAKEN')
        _history(self.patient, self.med,  'SKIPPED')
        _history(self.patient, med2, 'TAKEN')
        from apps.analytics.engine import calculate_adherence
        result = calculate_adherence(self.patient, days=7)
        self.assertEqual(len(result['per_medication']), 2)


@pytest.mark.django_db
class TestDashboardEndpoint(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user, self.patient = _patient()
        self.med = _med(self.patient)
        _history(self.patient, self.med, 'TAKEN')

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_patient_dashboard(self, mock_verify):
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get('/api/v1/analytics/dashboard/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('adherence_7d', response.data)
        self.assertIn('active_medications', response.data)
        self.assertIn('abnormal_labs', response.data)
        self.assertIn('last_insight', response.data)
        self.assertEqual(response.data['active_medications'], 1)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_adherence_endpoint_days_param(self, mock_verify):
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        for days in (7, 30, 90):
            response = self.client.get(f'/api/v1/analytics/adherence/?days={days}')
            self.assertEqual(response.status_code, status.HTTP_200_OK)
            self.assertEqual(response.data['days'], days)


@pytest.mark.django_db
class TestInsights(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user, self.patient = _patient()

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_empty_insights_list(self, mock_verify):
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get('/api/v1/analytics/insights/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 0)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    @patch('apps.analytics.tasks.generate_patient_insight.delay')
    def test_generate_insight_enqueues_task(self, mock_delay, mock_verify):
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post('/api/v1/analytics/insights/generate/', {
            'insight_type': 'MEDICATION_ADHERENCE',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        mock_delay.assert_called_once()

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_list_insights_with_filter(self, mock_verify):
        HealthInsight.objects.create(
            patient=self.patient, insight_type='VITAL_TREND',
            provider='RULE_BASED', summary='Test vital', detail='', actions=[],
        )
        HealthInsight.objects.create(
            patient=self.patient, insight_type='MEDICATION_ADHERENCE',
            provider='RULE_BASED', summary='Test med', detail='', actions=[],
        )
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get('/api/v1/analytics/insights/?type=VITAL_TREND')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)


@pytest.mark.django_db
class TestAIRouting(TestCase):

    def setUp(self):
        self.user, self.patient = _patient()

    def test_free_tier_uses_fallback_on_error(self):
        from apps.analytics.ai_service import _fallback_insight
        result = _fallback_insight('MEDICATION_ADHERENCE', {'adherence': {'adherence_pct': 50}}, 'hash123')
        self.assertIn('summary', result)
        self.assertEqual(result['provider'], 'RULE_BASED')
        self.assertIsInstance(result['actions'], list)

    @patch('apps.analytics.ai_service._call_openai')
    def test_silver_tier_uses_openai(self, mock_openai):
        import json
        mock_openai.return_value = json.dumps({
            'summary': 'Tu salud está bien',
            'detail': 'Detalle.',
            'actions': [{'action': 'Toma agua', 'priority': 'low'}],
        })
        from apps.payments.models import Plan, Subscription
        plan, _ = Plan.objects.get_or_create(
            tier='SILVER',
            defaults={'name': 'Silver', 'price_mxn': 99, 'max_doctors': 2},
        )
        Subscription.objects.create(user=self.user, plan=plan, status='ACTIVE')

        from apps.analytics.ai_service import get_insight
        result = get_insight(self.patient, 'GENERAL_HEALTH', {})
        self.assertEqual(result['provider'], 'OPENAI')
        mock_openai.assert_called_once()

    @patch('apps.analytics.ai_service._call_claude')
    def test_platinum_tier_uses_claude(self, mock_claude):
        import json
        mock_claude.return_value = json.dumps({
            'summary': 'Análisis clínico avanzado',
            'detail': 'Claude detail.',
            'actions': [],
        })
        from apps.payments.models import Plan, Subscription
        plan, _ = Plan.objects.get_or_create(
            tier='PLATINUM',
            defaults={'name': 'Platinum', 'price_mxn': 499, 'max_doctors': 99},
        )
        Subscription.objects.create(user=self.user, plan=plan, status='ACTIVE')

        from apps.analytics.ai_service import get_insight
        result = get_insight(self.patient, 'GENERAL_HEALTH', {})
        self.assertEqual(result['provider'], 'ANTHROPIC')
        mock_claude.assert_called_once()


@pytest.mark.django_db
class TestWeeklyAdherenceTask(TestCase):

    def setUp(self):
        self.user, self.patient = _patient()
        self.med = _med(self.patient)

    def test_creates_adherence_report(self):
        for i in range(4):
            _history(self.patient, self.med, 'TAKEN', hours_ago=i * 8)
        _history(self.patient, self.med, 'SKIPPED', hours_ago=40)

        from apps.analytics.tasks import generate_weekly_adherence_report
        count = generate_weekly_adherence_report()
        self.assertGreaterEqual(count, 1)
        self.assertTrue(AdherenceReport.objects.filter(patient=self.patient).exists())


@pytest.mark.django_db
class TestDoctorDashboard(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.patient_user, self.patient = _patient()
        self.doctor_user, self.doctor = _doctor()
        DoctorPatient.objects.create(doctor=self.doctor, patient=self.patient, is_active=True)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_doctor_sees_patient_dashboard(self, mock_verify):
        mock_verify.return_value = {'sub': 'doc_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get(f'/api/v1/analytics/patient/{self.patient.id}/dashboard/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('adherence_7d', response.data)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_unassigned_doctor_blocked(self, mock_verify):
        other_user, _ = _doctor(email='dr2@test.com', clerk_id='doc_002')
        mock_verify.return_value = {'sub': 'doc_002'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get(f'/api/v1/analytics/patient/{self.patient.id}/dashboard/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
