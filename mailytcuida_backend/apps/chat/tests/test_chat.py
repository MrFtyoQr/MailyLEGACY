import pytest
from unittest.mock import patch
from django.test import TestCase
from rest_framework.test import APIClient
from rest_framework import status
from apps.accounts.models import User, PatientProfile, DoctorProfile, DoctorPatient
from apps.chat.models import Conversation, Message


def _patient(email='p@test.com', clerk_id='pat_001'):
    user = User.objects.create_user(email=email, clerk_id=clerk_id, role='PATIENT')
    profile = PatientProfile.objects.create(user=user, first_name='Camila', last_name='Ríos')
    return user, profile


def _doctor(email='dr@test.com', clerk_id='doc_001'):
    user = User.objects.create_user(email=email, clerk_id=clerk_id, role='DOCTOR')
    profile = DoctorProfile.objects.create(
        user=user, first_name='Roberto', last_name='Fuentes', license_number='MED-020'
    )
    return user, profile


def _conversation(patient, doctor):
    return Conversation.objects.create(patient=patient, doctor=doctor)


def _message(conv, sender, text='Hola'):
    return Message.objects.create(conversation=conv, sender=sender, text=text)


@pytest.mark.django_db
class TestConversationCreate(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.patient_user, self.patient = _patient()
        self.doctor_user, self.doctor = _doctor()

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_patient_starts_conversation_with_assigned_doctor(self, mock_verify):
        DoctorPatient.objects.create(doctor=self.doctor, patient=self.patient, is_active=True)
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post('/api/v1/chat/', {'doctor_id': str(self.doctor.id)}, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertTrue(Conversation.objects.filter(patient=self.patient, doctor=self.doctor).exists())

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_second_request_returns_existing_conversation(self, mock_verify):
        DoctorPatient.objects.create(doctor=self.doctor, patient=self.patient, is_active=True)
        _conversation(self.patient, self.doctor)
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post('/api/v1/chat/', {'doctor_id': str(self.doctor.id)}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(Conversation.objects.count(), 1)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_patient_cannot_chat_with_unassigned_doctor(self, mock_verify):
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post('/api/v1/chat/', {'doctor_id': str(self.doctor.id)}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_doctor_cannot_initiate_conversation(self, mock_verify):
        mock_verify.return_value = {'sub': 'doc_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post('/api/v1/chat/', {'doctor_id': str(self.doctor.id)}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


@pytest.mark.django_db
class TestConversationList(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.patient_user, self.patient = _patient()
        self.doctor_user, self.doctor = _doctor()
        self.conv = _conversation(self.patient, self.doctor)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_patient_sees_own_conversations(self, mock_verify):
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get('/api/v1/chat/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_doctor_sees_own_conversations(self, mock_verify):
        mock_verify.return_value = {'sub': 'doc_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get('/api/v1/chat/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)


@pytest.mark.django_db
class TestMessageCRUD(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.patient_user, self.patient = _patient()
        self.doctor_user, self.doctor = _doctor()
        self.conv = _conversation(self.patient, self.doctor)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    @patch('apps.chat.views._notify_recipient')
    def test_patient_sends_message(self, mock_notify, mock_verify):
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post(
            f'/api/v1/chat/{self.conv.id}/messages/',
            {'text': 'Buenos días doctor', 'message_type': 'TEXT'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Message.objects.count(), 1)
        mock_notify.assert_called_once()

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    @patch('apps.chat.views._notify_recipient')
    def test_doctor_sends_message(self, mock_notify, mock_verify):
        mock_verify.return_value = {'sub': 'doc_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post(
            f'/api/v1/chat/{self.conv.id}/messages/',
            {'text': 'Buenos días, ¿cómo se siente?', 'message_type': 'TEXT'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    @patch('apps.chat.views._notify_recipient')
    def test_empty_text_rejected(self, mock_notify, mock_verify):
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post(
            f'/api/v1/chat/{self.conv.id}/messages/',
            {'text': '   ', 'message_type': 'TEXT'},
            format='json',
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_list_messages_paginated(self, mock_verify):
        for i in range(5):
            _message(self.conv, self.patient_user, text=f'Mensaje {i}')
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get(f'/api/v1/chat/{self.conv.id}/messages/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 5)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_third_party_cannot_access_conversation(self, mock_verify):
        stranger_user = User.objects.create_user(
            email='x@test.com', clerk_id='str_001', role='PATIENT'
        )
        mock_verify.return_value = {'sub': 'str_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get(f'/api/v1/chat/{self.conv.id}/messages/')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


@pytest.mark.django_db
class TestMarkRead(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.patient_user, self.patient = _patient()
        self.doctor_user, self.doctor = _doctor()
        self.conv = _conversation(self.patient, self.doctor)

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_mark_messages_read(self, mock_verify):
        # Doctor sends 3 unread messages
        for _ in range(3):
            _message(self.conv, self.doctor_user)
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.post(f'/api/v1/chat/{self.conv.id}/read/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['marked_read'], 3)
        self.assertEqual(
            Message.objects.filter(conversation=self.conv, is_read=True).count(), 3
        )

    @patch('apps.accounts.middleware.clerk_auth._verify_clerk_token')
    def test_unread_count(self, mock_verify):
        _message(self.conv, self.doctor_user)
        _message(self.conv, self.doctor_user)
        mock_verify.return_value = {'sub': 'pat_001'}
        self.client.credentials(HTTP_AUTHORIZATION='Bearer fake')
        response = self.client.get('/api/v1/chat/unread-count/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['unread'], 2)
