from rest_framework import serializers
from apps.accounts.models import DoctorProfile
from .models import Conversation, Message


class MessageSerializer(serializers.ModelSerializer):
    sender_email = serializers.EmailField(source='sender.email', read_only=True)

    class Meta:
        model = Message
        fields = [
            'id', 'sender', 'sender_email', 'message_type',
            'text', 'file_url', 'file_name',
            'is_read', 'read_at', 'created_at',
        ]
        read_only_fields = ['id', 'sender', 'sender_email', 'is_read', 'read_at', 'created_at']

    def validate(self, attrs):
        msg_type = attrs.get('message_type', Message.MessageType.TEXT)
        if msg_type == Message.MessageType.TEXT and not attrs.get('text', '').strip():
            raise serializers.ValidationError({'text': 'El texto no puede estar vacío.'})
        if msg_type in (Message.MessageType.IMAGE, Message.MessageType.FILE):
            if not attrs.get('file_url'):
                raise serializers.ValidationError(
                    {'file_url': 'Requerido para mensajes de tipo IMAGE o FILE.'}
                )
        return attrs


class ConversationSerializer(serializers.ModelSerializer):
    last_message   = serializers.SerializerMethodField()
    unread_count   = serializers.SerializerMethodField()
    doctor_name    = serializers.SerializerMethodField()
    patient_name   = serializers.SerializerMethodField()

    class Meta:
        model = Conversation
        fields = [
            'id', 'patient', 'doctor',
            'doctor_name', 'patient_name',
            'is_active', 'last_message', 'unread_count',
            'created_at', 'updated_at',
        ]
        read_only_fields = fields

    def get_last_message(self, obj):
        msg = obj.messages.order_by('-created_at').first()
        return MessageSerializer(msg).data if msg else None

    def get_unread_count(self, obj):
        user = self.context['request'].user
        return obj.messages.filter(is_read=False).exclude(sender=user).count()

    def get_doctor_name(self, obj):
        return f'{obj.doctor.first_name} {obj.doctor.last_name}'

    def get_patient_name(self, obj):
        return f'{obj.patient.first_name} {obj.patient.last_name}'


class ConversationCreateSerializer(serializers.Serializer):
    doctor_id = serializers.UUIDField()

    def validate_doctor_id(self, value):
        try:
            DoctorProfile.objects.get(pk=value)
        except DoctorProfile.DoesNotExist:
            raise serializers.ValidationError('Doctor no encontrado.')
        return value
