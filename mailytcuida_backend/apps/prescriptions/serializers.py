from rest_framework import serializers
from .models import Prescription, PrescriptionVerification


class PrescriptionVerificationSerializer(serializers.ModelSerializer):
    class Meta:
        model  = PrescriptionVerification
        fields = [
            'token', 'verification_url', 'issued_by_name', 'issued_by_license',
            'clinic_name', 'is_valid', 'invalidated_at', 'created_at',
        ]
        read_only_fields = fields


class PrescriptionSerializer(serializers.ModelSerializer):
    verification = PrescriptionVerificationSerializer(read_only=True)
    source_display = serializers.CharField(source='get_source_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model  = Prescription
        fields = [
            'id', 'source', 'source_display',
            'file_url', 'file_name', 'mime_type', 'thumbnail_url',
            'title', 'prescribed_by', 'clinic_name',
            'prescribed_at', 'expires_at', 'notes',
            'status', 'status_display',
            'medications_listed',
            'mailysoft_id',
            'verification',
            'is_active', 'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'source', 'mailysoft_id', 'verification',
            'created_at', 'updated_at',
        ]


class PrescriptionCreateSerializer(serializers.ModelSerializer):
    """Used by patient when manually uploading a prescription photo/PDF."""

    class Meta:
        model  = Prescription
        fields = [
            'file_url', 'file_name', 'mime_type', 'thumbnail_url',
            'title', 'prescribed_by', 'clinic_name',
            'prescribed_at', 'expires_at', 'notes',
            'medications_listed',
        ]

    def validate_file_url(self, value):
        if value and not value.startswith('http'):
            raise serializers.ValidationError('file_url debe ser una URL absoluta válida.')
        return value


class PrescriptionUpdateSerializer(serializers.ModelSerializer):
    """Patient can annotate or update editable fields on any prescription."""

    class Meta:
        model  = Prescription
        fields = [
            'title', 'notes', 'prescribed_at', 'expires_at',
            'status', 'medications_listed',
        ]


# ── MailySoft webhook payload ─────────────────────────────────────────────────

class WebhookMedicationSerializer(serializers.Serializer):
    name         = serializers.CharField()
    dose         = serializers.CharField(default='')
    instructions = serializers.CharField(default='')


class PrescriptionWebhookPayload(serializers.Serializer):
    """
    Contract for the MailySoft → MailyT-Cuida webhook.

    MailySoft sends this payload when a doctor digitally issues a
    prescription to one of their patients.

    The `patient_clerk_id` is used to locate the patient in MailyT-Cuida.
    If no patient is found the webhook returns 404 (patient not registered
    in the app yet — MailySoft should retry or notify the doctor).
    """
    mailysoft_prescription_id = serializers.CharField(max_length=128)
    mailysoft_doctor_id       = serializers.CharField(max_length=128)
    mailysoft_clinic_id       = serializers.CharField(max_length=128, default='')
    patient_clerk_id          = serializers.CharField(max_length=128,
                                                       help_text='Clerk user ID of the patient')
    doctor_name               = serializers.CharField(max_length=255)
    doctor_license            = serializers.CharField(max_length=128, default='')
    clinic_name               = serializers.CharField(max_length=255, default='')
    prescribed_at             = serializers.DateField()
    expires_at                = serializers.DateField(required=False, allow_null=True)
    file_url                  = serializers.URLField(max_length=1024, required=False, allow_blank=True)
    thumbnail_url             = serializers.URLField(max_length=1024, required=False, allow_blank=True)
    medications               = WebhookMedicationSerializer(many=True, default=list)
    notes                     = serializers.CharField(default='', allow_blank=True)
    # Verification QR data
    verification_token        = serializers.CharField(max_length=64)
    verification_url          = serializers.URLField(max_length=1024, required=False, allow_blank=True)
    signature                 = serializers.CharField(required=False, allow_blank=True)


# ── Public QR verification response ──────────────────────────────────────────

class PublicVerificationSerializer(serializers.ModelSerializer):
    prescription_date = serializers.DateField(source='prescription.prescribed_at')
    expires_at        = serializers.DateField(source='prescription.expires_at')
    medications       = serializers.JSONField(source='prescription.medications_listed')

    class Meta:
        model  = PrescriptionVerification
        fields = [
            'is_valid', 'invalidated_at',
            'issued_by_name', 'issued_by_license', 'clinic_name',
            'prescription_date', 'expires_at', 'medications',
            'created_at',
        ]
        read_only_fields = fields
