from rest_framework import serializers
from .models import FamilyCareLink, VitalMonitorConfig, CareAlert, MedicationPayment


class FamilyCareLinkCreateSerializer(serializers.ModelSerializer):
    patient_email = serializers.EmailField(write_only=True)

    class Meta:
        model = FamilyCareLink
        fields = ['patient_email', 'relationship_type', 'permissions']

    def validate_patient_email(self, value):
        from apps.accounts.models import User
        try:
            return User.objects.get(email=value)
        except User.DoesNotExist:
            raise serializers.ValidationError('No existe un usuario con ese email.')

    def validate(self, attrs):
        caregiver = self.context['request'].user
        patient = attrs['patient_email']
        if caregiver == patient:
            raise serializers.ValidationError('No puedes ser tu propio cuidador.')
        if FamilyCareLink.objects.filter(caregiver=caregiver, patient=patient).exists():
            raise serializers.ValidationError('Ya existe un vínculo con este usuario.')
        attrs['patient'] = patient
        attrs.pop('patient_email')
        return attrs

    def create(self, validated_data):
        validated_data['caregiver'] = self.context['request'].user
        if not validated_data.get('permissions'):
            validated_data['permissions'] = {
                'vitals': True, 'medications': True, 'appointments': True,
                'can_dispatch_doctor': False, 'can_pay_meds': False,
            }
        return super().create(validated_data)


class FamilyCareLinkSerializer(serializers.ModelSerializer):
    caregiver_email    = serializers.EmailField(source='caregiver.email', read_only=True)
    patient_email      = serializers.EmailField(source='patient.email', read_only=True)
    relationship_display = serializers.CharField(read_only=True)
    status_display     = serializers.CharField(read_only=True)

    class Meta:
        model = FamilyCareLink
        fields = [
            'id', 'caregiver_email', 'patient_email', 'relationship_type',
            'relationship_display', 'status', 'status_display', 'permissions',
            'requested_at', 'consent_at', 'revoked_at',
        ]
        read_only_fields = ['id', 'status', 'requested_at', 'consent_at', 'revoked_at']


class VitalMonitorConfigSerializer(serializers.ModelSerializer):
    vital_type_display = serializers.CharField(read_only=True)

    class Meta:
        model = VitalMonitorConfig
        fields = [
            'id', 'vital_type', 'vital_type_display', 'reminder_frequency_hours',
            'last_patient_reading_at', 'last_reminder_sent_at', 'is_active',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'last_patient_reading_at', 'last_reminder_sent_at', 'created_at', 'updated_at']


class VitalSignReadSerializer(serializers.Serializer):
    id         = serializers.UUIDField()
    vital_type = serializers.CharField()
    value      = serializers.FloatField()
    unit       = serializers.CharField()
    notes      = serializers.CharField()
    recorded_at = serializers.DateTimeField()


class VitalFrequencySerializer(serializers.Serializer):
    vital_type         = serializers.CharField()
    vital_type_display = serializers.CharField()
    last_24h           = serializers.IntegerField()
    last_7d            = serializers.IntegerField()
    last_30d           = serializers.IntegerField()
    last_reading_at    = serializers.DateTimeField(allow_null=True)
    monitor_config     = VitalMonitorConfigSerializer(allow_null=True)


class MedicationReadSerializer(serializers.Serializer):
    id             = serializers.UUIDField()
    name           = serializers.CharField()
    dosage         = serializers.CharField()
    unit           = serializers.CharField()
    frequency      = serializers.CharField()
    is_active      = serializers.BooleanField()
    adherence_7d   = serializers.FloatField()


class AppointmentNoteReadSerializer(serializers.Serializer):
    id         = serializers.UUIDField()
    subjective = serializers.CharField()
    objective  = serializers.CharField()
    assessment = serializers.CharField()
    plan       = serializers.CharField()
    created_at = serializers.DateTimeField()


class AppointmentReadSerializer(serializers.Serializer):
    id           = serializers.UUIDField()
    doctor_name  = serializers.SerializerMethodField()
    specialty    = serializers.CharField()
    appointment_type = serializers.CharField()
    status       = serializers.CharField()
    scheduled_at = serializers.DateTimeField()
    notes        = AppointmentNoteReadSerializer(many=True)

    def get_doctor_name(self, obj):
        return getattr(obj, 'doctor_name', '')


class CareAlertSerializer(serializers.ModelSerializer):
    class Meta:
        model = CareAlert
        fields = [
            'id', 'alert_type', 'vital_type', 'severity', 'status',
            'notes', 'created_at', 'resolved_at',
        ]
        read_only_fields = fields


class DispatchDoctorSerializer(serializers.Serializer):
    appointment_type = serializers.ChoiceField(choices=['IN_PERSON', 'VIDEO'], default='IN_PERSON')
    scheduled_at     = serializers.DateTimeField()
    reason           = serializers.CharField(max_length=500, default='Alerta de cuidado familiar')


class MedicationPaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = MedicationPayment
        fields = [
            'id', 'description', 'amount_mxn', 'status', 'paid_at', 'created_at',
        ]
        read_only_fields = fields


class MedicationPaymentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = MedicationPayment
        fields = ['description', 'amount_mxn', 'prescription', 'medication']

    def validate_amount_mxn(self, value):
        if value <= 0:
            raise serializers.ValidationError('El monto debe ser mayor a 0.')
        return value
