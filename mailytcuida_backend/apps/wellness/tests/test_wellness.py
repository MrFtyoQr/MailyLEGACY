"""
Tests — Wellness module (M21).

Coverage:
  - Staff creates wellness program
  - Staff adds activities
  - Staff enrolls patient
  - Patient logs mood entry → DailyCheckin updated
  - Patient logs sleep entry → DailyCheckin updated
  - Patient completes activity → progress tracked
  - Double completion is idempotent
  - Mood score out of range → 400
  - Sleep duration out of range → 400
"""
import uuid
from datetime import date, datetime, timezone

from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import PatientProfile, User
from apps.wellness.models import (
    ActivityCompletion,
    DailyCheckin,
    MoodEntry,
    ProgramEnrollment,
    WellnessActivity,
    WellnessProgram,
)


def _make_user(role='PATIENT', email=None):
    email = email or f'{role.lower()}-{uuid.uuid4().hex[:6]}@wellness.com'
    return User.objects.create_user(
        email=email, password='Test1234!', role=role,
        clerk_id=f'clerk_{uuid.uuid4().hex}',
    )


def _make_patient(user):
    return PatientProfile.objects.get_or_create(user=user)[0]


def _auth(user):
    c = APIClient()
    c.force_authenticate(user=user)
    return c


class WellnessProgramCRUDTest(TestCase):
    def setUp(self):
        self.admin = _make_user('ADMIN', 'admin@well.com')

    def test_admin_creates_program(self):
        c = _auth(self.admin)
        r = c.post('/api/v1/wellness/programs/', {
            'title': '21 Días de Mindfulness',
            'category': 'MINDFULNESS',
            'duration_days': 21,
        }, format='json')
        self.assertEqual(r.status_code, 201)

    def test_patient_cannot_create_program(self):
        pu = _make_user('PATIENT', 'nope@well.com')
        c = _auth(pu)
        r = c.post('/api/v1/wellness/programs/', {'title': 'X', 'category': 'CUSTOM', 'duration_days': 7}, format='json')
        self.assertEqual(r.status_code, 403)

    def test_add_activity_to_program(self):
        c = _auth(self.admin)
        pr = c.post('/api/v1/wellness/programs/', {'title': 'Test', 'category': 'SLEEP', 'duration_days': 7}, format='json')
        pid = pr.data['id']
        r = c.post(f'/api/v1/wellness/programs/{pid}/activities/', {
            'day_number': 1, 'order': 1,
            'title': 'Respiración 4-7-8',
            'activity_type': 'BREATHING',
            'duration_min': 5,
            'points_reward': 10,
        }, format='json')
        self.assertEqual(r.status_code, 201)


class MoodSleepCheckinTest(TestCase):
    def setUp(self):
        self.admin = _make_user('ADMIN', 'admin2@well.com')
        self.pu = _make_user('PATIENT', 'pat@well.com')
        self.patient = _make_patient(self.pu)

    def test_patient_logs_mood(self):
        c = _auth(self.pu)
        r = c.post('/api/v1/wellness/mood/', {
            'logged_at': '2026-04-24T09:00:00Z',
            'score': 8,
            'label': 'GOOD',
            'tags': ['energético'],
            'note': 'Buen día',
        }, format='json')
        self.assertEqual(r.status_code, 201)
        # Check-in should be created
        checkin = DailyCheckin.objects.get(patient=self.patient, date=date(2026, 4, 24))
        self.assertEqual(checkin.mood_score, 8)

    def test_invalid_mood_score(self):
        c = _auth(self.pu)
        r = c.post('/api/v1/wellness/mood/', {
            'logged_at': '2026-04-24T09:00:00Z',
            'score': 11,
            'label': 'GOOD',
        }, format='json')
        self.assertEqual(r.status_code, 400)

    def test_patient_logs_sleep(self):
        c = _auth(self.pu)
        r = c.post('/api/v1/wellness/sleep/', {
            'sleep_date': '2026-04-23',
            'duration_hours': '7.5',
            'quality': 'GOOD',
            'interruptions': 1,
        }, format='json')
        self.assertEqual(r.status_code, 201)
        checkin = DailyCheckin.objects.get(patient=self.patient, date=date(2026, 4, 23))
        self.assertEqual(str(checkin.sleep_hours), '7.5')

    def test_invalid_sleep_duration(self):
        c = _auth(self.pu)
        r = c.post('/api/v1/wellness/sleep/', {
            'sleep_date': '2026-04-23',
            'duration_hours': '25',
            'quality': 'GOOD',
        }, format='json')
        self.assertEqual(r.status_code, 400)


class ActivityCompletionTest(TestCase):
    def setUp(self):
        self.admin = _make_user('ADMIN', 'admin3@well.com')
        self.pu = _make_user('PATIENT', 'pat2@well.com')
        self.patient = _make_patient(self.pu)

        self.program = WellnessProgram.objects.create(
            title='Stress Buster', category='STRESS', created_by=self.admin
        )
        self.activity = WellnessActivity.objects.create(
            program=self.program, day_number=1, order=1,
            title='Meditación 5 min', activity_type='AUDIO',
            duration_min=5, points_reward=20,
        )
        self.enrollment = ProgramEnrollment.objects.create(
            program=self.program, patient=self.patient,
            enrolled_by=self.admin, start_date=date.today(),
        )

    def test_patient_completes_activity(self):
        c = _auth(self.pu)
        r = c.post(f'/api/v1/wellness/enrollments/{self.enrollment.id}/complete-activity/', {
            'activity': str(self.activity.id),
            'note': 'Muy relajante',
        }, format='json')
        self.assertEqual(r.status_code, 201)
        self.assertTrue(ActivityCompletion.objects.filter(
            enrollment=self.enrollment, activity=self.activity
        ).exists())

    def test_double_completion_is_idempotent(self):
        from apps.wellness.services import complete_activity
        c1 = complete_activity(self.enrollment, self.activity)
        c2 = complete_activity(self.enrollment, self.activity)
        self.assertEqual(c1.id, c2.id)
        self.assertEqual(ActivityCompletion.objects.filter(enrollment=self.enrollment).count(), 1)

    def test_enrollment_marked_complete_when_all_done(self):
        from apps.wellness.services import complete_activity
        complete_activity(self.enrollment, self.activity)
        self.enrollment.refresh_from_db()
        self.assertEqual(self.enrollment.status, ProgramEnrollment.Status.COMPLETED)
