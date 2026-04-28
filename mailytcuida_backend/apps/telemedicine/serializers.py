from rest_framework import serializers
from .models import VideoSession, SessionCheckin, SessionNote


class SessionNoteSerializer(serializers.ModelSerializer):
    class Meta:
        model  = SessionNote
        fields = [
            'id', 'subjective', 'objective', 'assessment', 'plan',
            'follow_up_days', 'prescriptions_issued', 'referrals_made',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class SessionCheckinSerializer(serializers.ModelSerializer):
    class Meta:
        model  = SessionCheckin
        fields = ['id', 'checked_in_at', 'pre_vitals', 'device_info']
        read_only_fields = ['id', 'checked_in_at']


class VideoSessionSerializer(serializers.ModelSerializer):
    status_display   = serializers.CharField(source='get_status_display', read_only=True)
    provider_display = serializers.CharField(source='get_provider_display', read_only=True)
    note             = SessionNoteSerializer(read_only=True)
    checkin          = SessionCheckinSerializer(read_only=True)
    patient_name     = serializers.SerializerMethodField()
    doctor_name      = serializers.SerializerMethodField()

    class Meta:
        model  = VideoSession
        fields = [
            'id', 'appointment',
            'provider', 'provider_display',
            'meeting_url', 'meeting_id', 'meeting_password',
            'status', 'status_display',
            'started_at', 'ended_at', 'duration_min',
            'checklist_completed',
            'tech_quality', 'patient_rating', 'patient_feedback',
            'patient_name', 'doctor_name',
            'note', 'checkin',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'started_at', 'ended_at', 'duration_min', 'created_at', 'updated_at'
        ]

    def get_patient_name(self, obj):
        p = obj.appointment.patient
        return f'{p.first_name} {p.last_name}'

    def get_doctor_name(self, obj):
        d = obj.appointment.doctor
        return f'Dr. {d.first_name} {d.last_name}'


class VideoSessionCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = VideoSession
        fields = ['appointment', 'provider', 'meeting_url', 'meeting_id', 'meeting_password']

    def validate_appointment(self, appt):
        if appt.appointment_type != 'VIDEO':
            raise serializers.ValidationError(
                'Solo se pueden crear sesiones de video para citas de tipo VIDEO.'
            )
        if hasattr(appt, 'video_session'):
            raise serializers.ValidationError(
                'Esta cita ya tiene una sesión de video asociada.'
            )
        return appt


class SessionStatusUpdateSerializer(serializers.Serializer):
    status = serializers.ChoiceField(
        choices=['WAITING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW']
    )


class PatientFeedbackSerializer(serializers.Serializer):
    tech_quality     = serializers.IntegerField(min_value=1, max_value=5)
    patient_rating   = serializers.IntegerField(min_value=1, max_value=5)
    patient_feedback = serializers.CharField(required=False, allow_blank=True)
