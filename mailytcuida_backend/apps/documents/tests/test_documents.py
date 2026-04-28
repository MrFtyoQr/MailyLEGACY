import pytest
from unittest.mock import patch, MagicMock
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient
from rest_framework import status
from apps.accounts.models import User, PatientProfile, DoctorProfile, DoctorPatient
from apps.documents.models import MedicalDocument, DocumentShare, HealthSummaryExport


def _patient(email='p@test.com', clerk_id='pat_001'):
    user    = User.objects.create_user(email=email, clerk_id=clerk_id, role='PATIENT')
    profile = PatientProfile.objects.create(user=user, first_name='Ana', last_name='López')
    return user, profile


def _doctor(email='dr@test.com', clerk_id='doc_001'):
    user    = User.objects.create_user(email=email, clerk_id=clerk_id, role='DOCTOR')
    profile = DoctorProfile.objects.create(
        user=user, first_name='José', last_name='García', license_number='MED-100'
    )
    return user, profile


def _doc(patient, category='LAB_RESULT', title='Análisis general'):
    return MedicalDocument.objects.create(
        patient=patient, category=category, title=title,
        file_url='https://r2.example.com/file.pdf',
        file_name='file.pdf', mime_type='application/pdf',
    )


@pytest.mark.django_db
class TestDocumentCRUD(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user, self.patient = _patient()

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_list_empty(self, mock_verify):
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get('/api/v1/documents/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    @patch('apps.documents.views.process_document_ocr')
    def test_create_document_triggers_ocr(self, mock_ocr, mock_verify):
        mock_verify.return_value = {'sub': 'pat_001'}
        mock_ocr.delay = MagicMock()
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post('/api/v1/documents/', {
            'category':  'LAB_RESULT',
            'title':     'Examen sangre',
            'file_url':  'https://r2.example.com/blood.pdf',
            'file_name': 'blood.pdf',
            'mime_type': 'application/pdf',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        mock_ocr.delay.assert_called_once()

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_create_document_no_ocr_for_text(self, mock_verify):
        """Plain text files should not trigger OCR."""
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        with patch('apps.documents.views.process_document_ocr') as mock_ocr:
            mock_ocr.delay = MagicMock()
            response = self.client.post('/api/v1/documents/', {
                'category':  'OTHER',
                'title':     'Nota',
                'file_url':  'https://r2.example.com/note.txt',
                'file_name': 'note.txt',
                'mime_type': 'text/plain',
            }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        mock_ocr.delay.assert_not_called()

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_soft_delete(self, mock_verify):
        doc = _doc(self.patient)
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.delete(f'/api/v1/documents/{doc.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        doc.refresh_from_db()
        self.assertFalse(doc.is_active)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_filter_by_category(self, mock_verify):
        _doc(self.patient, 'LAB_RESULT')
        _doc(self.patient, 'PRESCRIPTION')
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get('/api/v1/documents/?category=LAB_RESULT')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get('results', response.data)
        self.assertEqual(len(results), 1)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_patch_title(self, mock_verify):
        doc = _doc(self.patient)
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.patch(f'/api/v1/documents/{doc.id}/', {'title': 'Nuevo título'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        doc.refresh_from_db()
        self.assertEqual(doc.title, 'Nuevo título')


@pytest.mark.django_db
class TestDocumentSharing(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user, self.patient = _patient()
        self.doc_user, self.doctor = _doctor()
        DoctorPatient.objects.create(doctor=self.doctor, patient=self.patient, is_active=True)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_share_with_assigned_doctor(self, mock_verify):
        doc = _doc(self.patient)
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post(f'/api/v1/documents/{doc.id}/shares/', {
            'doctor_id': str(self.doctor.id),
        }, format='json')
        self.assertIn(response.status_code, [status.HTTP_200_OK, status.HTTP_201_CREATED])
        self.assertTrue(DocumentShare.objects.filter(document=doc, doctor=self.doctor, is_active=True).exists())

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_share_with_unassigned_doctor_is_forbidden(self, mock_verify):
        _, other_doc = _doctor(email='dr2@test.com', clerk_id='doc_002')
        doc = _doc(self.patient)
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post(f'/api/v1/documents/{doc.id}/shares/', {
            'doctor_id': str(other_doc.id),
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_revoke_share(self, mock_verify):
        doc   = _doc(self.patient)
        share = DocumentShare.objects.create(document=doc, doctor=self.doctor, is_active=True)
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.delete(f'/api/v1/documents/{doc.id}/shares/{share.id}/')
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        share.refresh_from_db()
        self.assertFalse(share.is_active)
        self.assertIsNotNone(share.revoked_at)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_doctor_sees_shared_documents(self, mock_verify):
        doc   = _doc(self.patient)
        DocumentShare.objects.create(document=doc, doctor=self.doctor, is_active=True)
        mock_verify.return_value = {'sub': 'doc_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get('/api/v1/documents/shared-with-me/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get('results', response.data)
        self.assertGreaterEqual(len(results), 1)


@pytest.mark.django_db
class TestPDFExport(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user, self.patient = _patient()

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    @patch('apps.documents.views.generate_health_summary_pdf')
    def test_export_request_returns_202(self, mock_task, mock_verify):
        mock_task.delay = MagicMock()
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post('/api/v1/documents/export/', {
            'sections': ['medications', 'vitals'],
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        self.assertIn('id', response.data)
        mock_task.delay.assert_called_once()

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_export_list(self, mock_verify):
        HealthSummaryExport.objects.create(
            patient=self.patient, sections=['medications'], status='READY',
            pdf_url='https://r2.example.com/export.pdf',
        )
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get('/api/v1/documents/exports/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        results = response.data.get('results', response.data)
        self.assertGreaterEqual(len(results), 1)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    @patch('apps.documents.views.generate_health_summary_pdf')
    def test_export_default_sections(self, mock_task, mock_verify):
        """Sending no sections should default to all 5."""
        mock_task.delay = MagicMock()
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post('/api/v1/documents/export/', {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        export = HealthSummaryExport.objects.get(pk=response.data['id'])
        self.assertEqual(len(export.sections), 5)


@pytest.mark.django_db
class TestOCRTrigger(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user, self.patient = _patient()

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    @patch('apps.documents.views.process_document_ocr')
    def test_ocr_endpoint_enqueues_task(self, mock_ocr, mock_verify):
        doc = _doc(self.patient)
        mock_ocr.delay = MagicMock()
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post(f'/api/v1/documents/{doc.id}/ocr/')
        self.assertEqual(response.status_code, status.HTTP_202_ACCEPTED)
        mock_ocr.delay.assert_called_once_with(str(doc.id))
