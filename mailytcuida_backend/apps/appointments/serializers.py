from django.utils import timezone
from rest_framework import serializers
from .models import Appointment, AppointmentNote


class AppointmentNoteSerializer(serializers.ModelSerializer):
    class Meta:
        model = AppointmentNote
        fields = [
            'id', 'chief_complaint', 'diagnosis',
            'treatment_plan', 'follow_up_days', 'prescriptions',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class AppointmentSerializer(serializers.ModelSerializer):
    clinical_note = AppointmentNoteSerializer(read_only=True)
    doctor_name   = serializers.SerializerMethodField()
    patient_name  = serializers.SerializerMethodField()

    class Meta:
        model = Appointment
        fields = [
            'id', 'patient', 'doctor', 'doctor_name', 'patient_name',
            'appointment_type', 'status',
            'scheduled_at', 'duration_minutes',
            'reason', 'notes', 'video_link', 'location',
            'reminder_24h_sent', 'reminder_1h_sent',
            'cancelled_by', 'cancellation_reason',
            'clinical_note', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'status', 'reminder_24h_sent', 'reminder_1h_sent',
            'cancelled_by', 'created_at', 'updated_at',
        ]

    def get_doctor_name(self, obj):
        return f'{obj.doctor.first_name} {obj.doctor.last_name}'

    def get_patient_name(self, obj):
        return f'{obj.patient.first_name} {obj.patient.last_name}'


class AppointmentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Appointment
        fields = ['doctor', 'appointment_type', 'scheduled_at', 'duration_minutes', 'reason', 'location']

    def validate_scheduled_at(self, value):
        if value <= timezone.now():
            raise serializers.ValidationError('La cita debe agendarse en el futuro.')
        return value

    def validate(self, attrs):
        doctor = attrs.get('doctor')
        appt_type = attrs.get('appointment_type', Appointment.AppointmentType.IN_PERSON)
        if appt_type == Appointment.AppointmentType.IN_PERSON:
            if not attrs.get('location'):
                raise serializers.ValidationError(
                    {'location': 'Requerido para citas presenciales.'}
                )
        return attrs


class CancelSerializer(serializers.Serializer):
    reason = serializers.CharField(required=False, allow_blank=True)


class RescheduleSerializer(serializers.Serializer):
    scheduled_at = serializers.DateTimeField()
    video_link   = serializers.URLField(required=False, allow_blank=True)
    location     = serializers.CharField(required=False, allow_blank=True)
    notes        = serializers.CharField(required=False, allow_blank=True)

    def validate_scheduled_at(self, value):
        if value <= timezone.now():
            raise serializers.ValidationError('La nueva fecha debe ser en el futuro.')
        return value


class ConfirmSerializer(serializers.Serializer):
    video_link = serializers.URLField(required=False, allow_blank=True)
    location   = serializers.CharField(required=False, allow_blank=True)
    notes      = serializers.CharField(required=False, allow_blank=True)
