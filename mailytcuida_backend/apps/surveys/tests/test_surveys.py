"""
Tests — Surveys module (M19).

Coverage:
  - Create survey (staff only)
  - Add questions to survey
  - Assign survey to patient
  - Patient submits response (happy path)
  - Double-submit returns 409
  - Required question missing → 400
"""
import uuid
from unittest.mock import patch

from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import PatientProfile, User
from apps.surveys.models import Survey, SurveyAssignment, SurveyQuestion


def _make_user(role='PATIENT', email=None):
    email = email or f'{role.lower()}-{uuid.uuid4().hex[:6]}@test.com'
    return User.objects.create_user(
        email=email, password='Test1234!', role=role,
        clerk_id=f'clerk_{uuid.uuid4().hex}',
    )


def _make_patient(user):
    return PatientProfile.objects.get_or_create(user=user)[0]


def _auth_client(user):
    client = APIClient()
    client.force_authenticate(user=user)
    return client


class SurveyCRUDTest(TestCase):
    def setUp(self):
        self.admin = _make_user('ADMIN', 'admin@test.com')
        self.patient_user = _make_user('PATIENT', 'pat@test.com')
        self.patient = _make_patient(self.patient_user)

    def _create_survey(self):
        client = _auth_client(self.admin)
        r = client.post('/api/v1/surveys/', {
            'title': 'PHQ-9 Mental Health',
            'description': 'Depression screening',
            'category': 'MENTAL_HEALTH',
            'estimated_minutes': 5,
            'is_active': True,
        }, format='json')
        return r

    def test_admin_creates_survey(self):
        r = self._create_survey()
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data['title'], 'PHQ-9 Mental Health')

    def test_patient_cannot_create_survey(self):
        client = _auth_client(self.patient_user)
        r = client.post('/api/v1/surveys/', {
            'title': 'Test', 'category': 'CUSTOM', 'estimated_minutes': 3,
        }, format='json')
        self.assertEqual(r.status_code, 403)

    def test_add_question_to_survey(self):
        r = self._create_survey()
        survey_id = r.data['id']
        client = _auth_client(self.admin)
        r2 = client.post(f'/api/v1/surveys/{survey_id}/questions/', {
            'order': 1,
            'text': '¿Con qué frecuencia te has sentido decaído?',
            'question_type': 'SCALE',
            'is_required': True,
            'scale_min_label': 'Nunca',
            'scale_max_label': 'Casi siempre',
        }, format='json')
        self.assertEqual(r2.status_code, 201)

    def test_choice_question_requires_options(self):
        r = self._create_survey()
        survey_id = r.data['id']
        client = _auth_client(self.admin)
        r2 = client.post(f'/api/v1/surveys/{survey_id}/questions/', {
            'order': 1, 'text': 'Pick one', 'question_type': 'SINGLE_CHOICE',
            'options': ['Solo una opción'],  # only 1 — invalid
            'is_required': True,
        }, format='json')
        self.assertEqual(r2.status_code, 400)


class SurveyAssignmentSubmitTest(TestCase):
    def setUp(self):
        self.admin = _make_user('ADMIN', 'admin2@test.com')
        self.patient_user = _make_user('PATIENT', 'pat2@test.com')
        self.patient = _make_patient(self.patient_user)

        self.survey = Survey.objects.create(
            title='Symptom Check', category='SYMPTOM_TRACKING',
            created_by=self.admin,
        )
        self.q_required = SurveyQuestion.objects.create(
            survey=self.survey, order=1,
            text='Pain level?', question_type='SCALE',
            is_required=True,
        )
        self.q_optional = SurveyQuestion.objects.create(
            survey=self.survey, order=2,
            text='Notes', question_type='TEXT',
            is_required=False,
        )
        self.assignment = SurveyAssignment.objects.create(
            survey=self.survey, patient=self.patient,
            assigned_by=self.admin,
        )

    @patch('apps.surveys.views.notify')
    def test_patient_submits_response(self, mock_notify):
        client = _auth_client(self.patient_user)
        r = client.post(
            f'/api/v1/surveys/assignments/{self.assignment.id}/submit/',
            {
                'answers': [
                    {'question': str(self.q_required.id), 'value': 7},
                ]
            },
            format='json',
        )
        self.assertEqual(r.status_code, 201)
        self.assignment.refresh_from_db()
        self.assertTrue(self.assignment.completed)

    @patch('apps.surveys.views.notify')
    def test_double_submit_returns_409(self, mock_notify):
        self.assignment.completed = True
        self.assignment.save()
        client = _auth_client(self.patient_user)
        r = client.post(
            f'/api/v1/surveys/assignments/{self.assignment.id}/submit/',
            {'answers': [{'question': str(self.q_required.id), 'value': 7}]},
            format='json',
        )
        self.assertEqual(r.status_code, 409)

    @patch('apps.surveys.views.notify')
    def test_missing_required_question_returns_400(self, mock_notify):
        client = _auth_client(self.patient_user)
        r = client.post(
            f'/api/v1/surveys/assignments/{self.assignment.id}/submit/',
            {'answers': []},  # no answers at all
            format='json',
        )
        self.assertEqual(r.status_code, 400)

    def test_patient_cannot_see_other_patients_assignment(self):
        other_user = _make_user('PATIENT', 'other@test.com')
        _make_patient(other_user)
        client = _auth_client(other_user)
        r = client.get(f'/api/v1/surveys/assignments/{self.assignment.id}/')
        self.assertEqual(r.status_code, 404)
