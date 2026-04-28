from rest_framework import serializers
from .models import MedicalDocument, DocumentShare, HealthSummaryExport


class MedicalDocumentSerializer(serializers.ModelSerializer):
    shared_with = serializers.SerializerMethodField()

    class Meta:
        model  = MedicalDocument
        fields = [
            'id', 'category', 'title', 'description',
            'file_url', 'file_name', 'file_size', 'mime_type',
            'status', 'document_date', 'is_active',
            'ocr_text', 'ocr_data', 'shared_with',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'status', 'ocr_text', 'ocr_data', 'created_at', 'updated_at']

    def get_shared_with(self, obj):
        active_shares = obj.shares.filter(is_active=True).select_related('doctor')
        return [
            {
                'doctor_id': str(share.doctor.id),
                'doctor_name': f'Dr. {share.doctor.first_name} {share.doctor.last_name}',
                'shared_at': share.shared_at,
            }
            for share in active_shares
        ]


class MedicalDocumentCreateSerializer(serializers.ModelSerializer):
    """Used only on POST — patient provides file metadata + URL after direct R2 upload."""

    class Meta:
        model  = MedicalDocument
        fields = [
            'category', 'title', 'description',
            'file_url', 'file_name', 'file_size', 'mime_type',
            'document_date',
        ]

    def validate_file_url(self, value):
        if not value.startswith('http'):
            raise serializers.ValidationError('file_url must be a valid absolute URL.')
        return value


class DocumentShareSerializer(serializers.ModelSerializer):
    doctor_name = serializers.SerializerMethodField()
    document_title = serializers.SerializerMethodField()

    class Meta:
        model  = DocumentShare
        fields = ['id', 'document', 'doctor', 'doctor_name', 'document_title',
                  'shared_at', 'revoked_at', 'is_active']
        read_only_fields = ['id', 'shared_at', 'revoked_at', 'is_active']

    def get_doctor_name(self, obj):
        return f'Dr. {obj.doctor.first_name} {obj.doctor.last_name}'

    def get_document_title(self, obj):
        return obj.document.title


class HealthSummaryExportSerializer(serializers.ModelSerializer):
    class Meta:
        model  = HealthSummaryExport
        fields = ['id', 'pdf_url', 'status', 'sections', 'error', 'created_at', 'completed_at']
        read_only_fields = ['id', 'pdf_url', 'status', 'error', 'created_at', 'completed_at']


class ExportRequestSerializer(serializers.Serializer):
    sections = serializers.ListField(
        child=serializers.ChoiceField(choices=[
            'medications', 'vitals', 'labs', 'appointments', 'insights',
        ]),
        default=['medications', 'vitals', 'labs', 'appointments', 'insights'],
    )
