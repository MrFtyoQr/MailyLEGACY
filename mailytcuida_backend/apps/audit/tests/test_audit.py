import pytest
from unittest.mock import patch
from django.test import TestCase, RequestFactory
from rest_framework.test import APIClient
from rest_framework import status
from apps.accounts.models import User, PatientProfile, DoctorProfile, DoctorPatient
from apps.audit.models import AuditLog, AuditAction, ResourceType
from apps.audit.logger import audit


def _patient(email='p@test.com', clerk_id='pat_001'):
    user    = User.objects.create_user(email=email, clerk_id=clerk_id, role='PATIENT')
    profile = PatientProfile.objects.create(user=user, first_name='Rosa', last_name='Paz')
    return user, profile


def _doctor(email='dr@test.com', clerk_id='doc_001'):
    user    = User.objects.create_user(email=email, clerk_id=clerk_id, role='DOCTOR')
    profile = DoctorProfile.objects.create(
        user=user, first_name='Juan', last_name='Ríos', license_number='MED-200'
    )
    return user, profile


def _admin(email='admin@test.com', clerk_id='adm_001'):
    return User.objects.create_user(email=email, clerk_id=clerk_id, role='ADMIN')


@pytest.mark.django_db
class TestAuditLogger(TestCase):

    def setUp(self):
        self.user, self.patient = _patient()
        self.factory = RequestFactory()

    def test_audit_from_actor_creates_entry(self):
        audit(
            actor         = self.user,
            action        = AuditAction.UPDATE,
            resource_type = ResourceType.MEDICATION,
            resource_id   = 'abc-123',
            patient       = self.patient,
        )
        # on_commit fires in TestCase wrapping transaction
        self.assertTrue(
            AuditLog.objects.filter(
                actor=self.user, action=AuditAction.UPDATE
            ).exists()
        )

    def test_audit_from_request_captures_ip(self):
        request = self.factory.get('/api/v1/medications/')
        request.META['REMOTE_ADDR'] = '192.168.1.1'
        request.user = self.user
        audit(
            request       = request,
            action        = AuditAction.READ,
            resource_type = ResourceType.MEDICATION,
        )
        entry = AuditLog.objects.filter(actor=self.user, action=AuditAction.READ).first()
        self.assertIsNotNone(entry)
        self.assertEqual(entry.ip_address, '192.168.1.1')

    def test_audit_log_is_immutable(self):
        audit(
            actor  = self.user,
            action = AuditAction.LOGIN,
        )
        entry = AuditLog.objects.filter(actor=self.user, action=AuditAction.LOGIN).first()
        self.assertIsNotNone(entry)
        entry.note = 'hacked'
        with self.assertRaises(ValueError):
            entry.save()

    def test_audit_log_cannot_be_deleted(self):
        audit(actor=self.user, action=AuditAction.LOGIN)
        entry = AuditLog.objects.filter(actor=self.user).first()
        with self.assertRaises(ValueError):
            entry.delete()

    def test_audit_never_raises_on_bad_input(self):
        """audit() must not raise; failures are silently logged."""
        result = audit(action=AuditAction.CREATE)  # no actor, no request
        # No exception means pass; result may be None or an entry

    def test_changed_fields_stored(self):
        audit(
            actor          = self.user,
            action         = AuditAction.UPDATE,
            resource_type  = ResourceType.VITAL_SIGN,
            resource_id    = 'vs-001',
            changed_fields = ['value', 'unit'],
        )
        entry = AuditLog.objects.filter(
            actor=self.user, action=AuditAction.UPDATE, resource_type=ResourceType.VITAL_SIGN
        ).first()
        self.assertIsNotNone(entry)
        self.assertIn('value', entry.changed_fields)


@pytest.mark.django_db
class TestAuditEndpoints(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user, self.patient = _patient()
        self.admin_user = _admin()

    def _create_entry(self, user=None, action=AuditAction.CREATE):
        AuditLog.objects.create(
            actor       = user or self.user,
            actor_email = (user or self.user).email,
            actor_role  = (user or self.user).role,
            action      = action,
            resource_type = ResourceType.MEDICATION,
        )

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_my_audit_log(self, mock_verify):
        self._create_entry()
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get('/api/v1/audit/my/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get('results', response.data)
        self.assertGreaterEqual(len(results), 1)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_admin_can_see_all(self, mock_verify):
        self._create_entry()
        mock_verify.return_value = {'sub': 'adm_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get('/api/v1/audit/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_non_admin_cannot_see_all(self, mock_verify):
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get('/api/v1/audit/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_admin_filter_by_action(self, mock_verify):
        self._create_entry(action=AuditAction.CREATE)
        self._create_entry(action=AuditAction.DELETE)
        mock_verify.return_value = {'sub': 'adm_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get(f'/api/v1/audit/?action={AuditAction.CREATE}')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get('results', response.data)
        for entry in results:
            self.assertEqual(entry['action'], AuditAction.CREATE)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_assigned_doctor_sees_patient_log(self, mock_verify):
        _, doctor = _doctor()
        DoctorPatient.objects.create(doctor=doctor, patient=self.patient, is_active=True)
        AuditLog.objects.create(
            actor=self.user, actor_email=self.user.email,
            actor_role=self.user.role, action=AuditAction.CREATE,
            resource_type=ResourceType.VITAL_SIGN, patient=self.patient,
        )
        mock_verify.return_value = {'sub': 'doc_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get(f'/api/v1/audit/patient/{self.patient.id}/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_unassigned_doctor_blocked_from_patient_log(self, mock_verify):
        _, other_doc = _doctor(email='dr2@test.com', clerk_id='doc_002')
        mock_verify.return_value = {'sub': 'doc_002'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get(f'/api/v1/audit/patient/{self.patient.id}/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


@pytest.mark.django_db
class TestAuditSignals(TestCase):
    """Verify signal receivers emit audit entries for key model events."""

    def setUp(self):
        self.user, self.patient = _patient()

    def test_medication_taken_triggers_audit(self):
        from apps.medications.models import Medication, MedicationHistory
        from django.utils import timezone
        med = Medication.objects.create(patient=self.patient, name='Aspirina', is_active=True)
        MedicationHistory.objects.create(
            patient=self.patient, medication=med,
            medication_name='Aspirina',
            scheduled_at=timezone.now(),
            status='TAKEN',
        )
        self.assertTrue(
            AuditLog.objects.filter(
                patient=self.patient, action=AuditAction.MEDICATION_TAKEN
            ).exists()
        )

    def test_document_share_triggers_audit(self):
        from apps.documents.models import MedicalDocument, DocumentShare
        _, doctor = _doctor()
        DoctorPatient.objects.create(doctor=doctor, patient=self.patient, is_active=True)
        doc = MedicalDocument.objects.create(
            patient=self.patient, title='Lab',
            file_url='https://r2.example.com/f.pdf',
        )
        DocumentShare.objects.create(document=doc, doctor=doctor, is_active=True)
        self.assertTrue(
            AuditLog.objects.filter(
                patient=self.patient, action=AuditAction.DOCUMENT_SHARED
            ).exists()
        )
