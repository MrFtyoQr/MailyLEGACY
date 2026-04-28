from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated

from apps.accounts.models import DoctorProfile, PatientProfile, DoctorPatient
from core.permissions import IsPatient, IsDoctor
from .models import Conversation, Message
from .serializers import ConversationSerializer, ConversationCreateSerializer, MessageSerializer


class MsgPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 200


def _get_conversation_for_user(pk, user):
    """Return conversation if the user is the patient or the doctor."""
    conv = get_object_or_404(Conversation, pk=pk)
    is_patient = hasattr(user, 'patient_profile') and conv.patient == user.patient_profile
    is_doctor  = hasattr(user, 'doctor_profile')  and conv.doctor  == user.doctor_profile
    if not (is_patient or is_doctor):
        from rest_framework.exceptions import PermissionDenied
        raise PermissionDenied()
    return conv


# ── Conversations ─────────────────────────────────────────────────────────────

class ConversationListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if hasattr(user, 'patient_profile'):
            qs = Conversation.objects.filter(patient=user.patient_profile)
        elif hasattr(user, 'doctor_profile'):
            qs = Conversation.objects.filter(doctor=user.doctor_profile)
        else:
            qs = Conversation.objects.none()
        serializer = ConversationSerializer(qs, many=True, context={'request': request})
        return Response(serializer.data)

    def post(self, request):
        """Patient starts a conversation with their assigned doctor."""
        if not hasattr(request.user, 'patient_profile'):
            return Response(
                {'detail': 'Solo los pacientes pueden iniciar conversaciones.'},
                status=status.HTTP_403_FORBIDDEN,
            )
        serializer = ConversationCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        doctor  = get_object_or_404(DoctorProfile, pk=serializer.validated_data['doctor_id'])
        patient = request.user.patient_profile

        # Enforce DoctorPatient relationship
        if not DoctorPatient.objects.filter(doctor=doctor, patient=patient, is_active=True).exists():
            return Response(
                {'detail': 'Solo puedes chatear con tu médico asignado.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        conv, created = Conversation.objects.get_or_create(patient=patient, doctor=doctor)
        http_status = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return Response(
            ConversationSerializer(conv, context={'request': request}).data,
            status=http_status,
        )


class ConversationDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        conv = _get_conversation_for_user(pk, request.user)
        return Response(ConversationSerializer(conv, context={'request': request}).data)


# ── Messages ──────────────────────────────────────────────────────────────────

class MessageListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = MessageSerializer
    pagination_class = MsgPagination

    def get_conversation(self):
        return _get_conversation_for_user(self.kwargs['conversation_pk'], self.request.user)

    def get_queryset(self):
        return self.get_conversation().messages.select_related('sender')

    def perform_create(self, serializer):
        conv = self.get_conversation()
        msg = serializer.save(sender=self.request.user, conversation=conv)
        # Bump conversation.updated_at for ordering
        conv.save(update_fields=['updated_at'])
        # Push notification to the other party if offline
        _notify_recipient(msg, conv, self.request.user)


class MarkReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        conv = _get_conversation_for_user(pk, request.user)
        now  = timezone.now()
        count = conv.messages.filter(
            is_read=False
        ).exclude(sender=request.user).update(is_read=True, read_at=now)
        return Response({'marked_read': count})


class UnreadCountView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        if hasattr(user, 'patient_profile'):
            qs = Message.objects.filter(
                conversation__patient=user.patient_profile, is_read=False
            ).exclude(sender=user)
        elif hasattr(user, 'doctor_profile'):
            qs = Message.objects.filter(
                conversation__doctor=user.doctor_profile, is_read=False
            ).exclude(sender=user)
        else:
            qs = Message.objects.none()
        return Response({'unread': qs.count()})


# ── helpers ───────────────────────────────────────────────────────────────────

def _notify_recipient(msg: Message, conv: Conversation, sender):
    """Send push notification to the other party via M07."""
    from apps.notifications.service import notify

    if hasattr(sender, 'patient_profile') and sender.patient_profile == conv.patient:
        recipient_user = conv.doctor.user
        doctor_name    = f'{conv.doctor.first_name} {conv.doctor.last_name}'
    else:
        recipient_user = conv.patient.user
        doctor_name    = f'{conv.doctor.first_name} {conv.doctor.last_name}'

    notify(
        user=recipient_user,
        code='DOCTOR_MESSAGE',
        context={'doctor_name': doctor_name},
        channel='PUSH',
        data={'screen': 'chat', 'conversation_id': str(conv.pk)},
    )
