"""
Tests — Nutrition module (M20).

Coverage:
  - Staff creates plan and adds meal slots
  - Staff assigns plan to patient
  - Patient logs food entries
  - Patient cannot log on behalf of another patient
  - DailyNutritionSummary compute task aggregates correctly
"""
import uuid
from datetime import date, datetime, timezone

from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import PatientProfile, User
from apps.nutrition.models import (
    DailyNutritionSummary,
    FoodEntry,
    NutritionPlan,
    NutritionPlanAssignment,
)


def _make_user(role='PATIENT', email=None):
    email = email or f'{role.lower()}-{uuid.uuid4().hex[:6]}@test.com'
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


class NutritionPlanCRUDTest(TestCase):
    def setUp(self):
        self.admin = _make_user('ADMIN', 'admin@nut.com')

    def test_admin_creates_plan(self):
        c = _auth(self.admin)
        r = c.post('/api/v1/nutrition/plans/', {
            'title': 'Plan Control Glucosa',
            'goal': 'DIABETES_CTRL',
            'target_kcal': 1800,
            'duration_days': 30,
        }, format='json')
        self.assertEqual(r.status_code, 201)

    def test_patient_cannot_create_plan(self):
        pu = _make_user('PATIENT', 'pat@nut.com')
        c = _auth(pu)
        r = c.post('/api/v1/nutrition/plans/', {'title': 'X', 'goal': 'CUSTOM', 'duration_days': 7}, format='json')
        self.assertEqual(r.status_code, 403)

    def test_add_meal_slot(self):
        c = _auth(self.admin)
        plan_r = c.post('/api/v1/nutrition/plans/', {'title': 'Plan Test', 'goal': 'MAINTENANCE', 'duration_days': 7}, format='json')
        plan_id = plan_r.data['id']
        r = c.post(f'/api/v1/nutrition/plans/{plan_id}/slots/', {
            'meal_type': 'BREAKFAST',
            'day_number': 1,
            'name': 'Avena con leche',
            'kcal': 350,
            'protein_g': '12.0',
            'carbs_g': '55.0',
            'fat_g': '7.0',
        }, format='json')
        self.assertEqual(r.status_code, 201)


class FoodDiaryTest(TestCase):
    def setUp(self):
        self.admin = _make_user('ADMIN', 'admin2@nut.com')
        self.pu = _make_user('PATIENT', 'pat2@nut.com')
        self.patient = _make_patient(self.pu)
        self.plan = NutritionPlan.objects.create(
            title='Test Plan', goal='MAINTENANCE', created_by=self.admin
        )
        self.assignment = NutritionPlanAssignment.objects.create(
            plan=self.plan, patient=self.patient,
            assigned_by=self.admin,
            start_date=date.today(),
        )

    def test_patient_logs_food_entry(self):
        c = _auth(self.pu)
        r = c.post('/api/v1/nutrition/entries/', {
            'logged_at': '2026-04-24T08:00:00Z',
            'meal_type': 'BREAKFAST',
            'food_name': 'Huevo revuelto',
            'quantity_g': '150.0',
            'kcal': 220,
            'protein_g': '18.0',
            'carbs_g': '1.5',
            'fat_g': '16.0',
        }, format='json')
        self.assertEqual(r.status_code, 201)

    def test_patient_lists_own_entries(self):
        FoodEntry.objects.create(
            patient=self.patient,
            logged_at=datetime(2026, 4, 24, 8, 0, tzinfo=timezone.utc),
            meal_type='BREAKFAST',
            food_name='Test food',
            quantity_g=100,
        )
        c = _auth(self.pu)
        r = c.get('/api/v1/nutrition/entries/')
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data['count'], 1)

    def test_patient_cannot_see_other_patient_entries(self):
        other = _make_user('PATIENT', 'other@nut.com')
        _make_patient(other)
        FoodEntry.objects.create(
            patient=self.patient,
            logged_at=datetime(2026, 4, 24, 8, 0, tzinfo=timezone.utc),
            meal_type='LUNCH', food_name='Private food', quantity_g=200,
        )
        c = _auth(other)
        r = c.get('/api/v1/nutrition/entries/')
        self.assertEqual(r.data['count'], 0)

    def test_invalid_quantity_returns_400(self):
        c = _auth(self.pu)
        r = c.post('/api/v1/nutrition/entries/', {
            'logged_at': '2026-04-24T12:00:00Z',
            'meal_type': 'LUNCH',
            'food_name': 'Nada',
            'quantity_g': '-10',
        }, format='json')
        self.assertEqual(r.status_code, 400)


class DailySummaryTaskTest(TestCase):
    def setUp(self):
        self.admin = _make_user('ADMIN', 'admin3@nut.com')
        self.pu = _make_user('PATIENT', 'pat3@nut.com')
        self.patient = _make_patient(self.pu)

    def test_compute_summary_aggregates_entries(self):
        from apps.nutrition.tasks import compute_daily_nutrition_summary
        target = '2026-04-23'
        dt = datetime(2026, 4, 23, 12, 0, tzinfo=timezone.utc)
        FoodEntry.objects.create(patient=self.patient, logged_at=dt, meal_type='LUNCH',
                                 food_name='A', quantity_g=200, kcal=300,
                                 protein_g=20, carbs_g=40, fat_g=5)
        FoodEntry.objects.create(patient=self.patient, logged_at=dt, meal_type='DINNER',
                                 food_name='B', quantity_g=150, kcal=200,
                                 protein_g=15, carbs_g=25, fat_g=8)

        # Run task synchronously
        result = compute_daily_nutrition_summary(target)
        self.assertEqual(result['patients_updated'], 1)

        summary = DailyNutritionSummary.objects.get(patient=self.patient, date=target)
        self.assertEqual(summary.total_kcal, 500)
        self.assertEqual(summary.entry_count, 2)
