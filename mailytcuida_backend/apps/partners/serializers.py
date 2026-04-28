from rest_framework import serializers
from .models import PartnerOrganization, PartnerAdmin, MemberEnrollment, PartnerHealthSnapshot


class PartnerOrganizationSerializer(serializers.ModelSerializer):
    active_members = serializers.SerializerMethodField()

    class Meta:
        model  = PartnerOrganization
        fields = [
            'id', 'name', 'rfc', 'industry', 'logo_url',
            'contact_name', 'contact_email', 'contact_phone',
            'status', 'agreement_start', 'agreement_end',
            'max_members', 'monthly_fee_mxn',
            'active_members', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def get_active_members(self, obj):
        return obj.enrollments.filter(is_active=True, consent=True).count()


class MemberEnrollmentSerializer(serializers.ModelSerializer):
    patient_name = serializers.SerializerMethodField()

    class Meta:
        model  = MemberEnrollment
        fields = [
            'id', 'patient', 'patient_name', 'employee_id',
            'consent', 'consent_at', 'is_active', 'enrolled_at',
        ]
        read_only_fields = ['id', 'consent_at', 'enrolled_at']

    def get_patient_name(self, obj):
        # Only expose name to ADMIN; partner sees "Miembro #<seq>"
        request = self.context.get('request')
        if request and getattr(request.user, 'role', '') == 'ADMIN':
            return f'{obj.patient.first_name} {obj.patient.last_name}'
        return f'Miembro #{obj.id.int % 10000:04d}'


class EnrollmentConsentSerializer(serializers.Serializer):
    consent = serializers.BooleanField()


class PartnerHealthSnapshotSerializer(serializers.ModelSerializer):
    is_suppressed = serializers.BooleanField(read_only=True)

    class Meta:
        model  = PartnerHealthSnapshot
        fields = [
            'id', 'period_start', 'period_end',
            'consenting_members', 'active_members',
            'avg_adherence_pct', 'low_adherence_count',
            'avg_vitals', 'is_suppressed', 'created_at',
        ]
        read_only_fields = fields


class PartnerDashboardSerializer(serializers.Serializer):
    """Aggregated summary returned by the dashboard endpoint."""
    organization        = PartnerOrganizationSerializer()
    latest_snapshot     = PartnerHealthSnapshotSerializer(allow_null=True)
    trend_adherence     = serializers.ListField(child=serializers.DictField())
    enrollment_count    = serializers.IntegerField()
    consenting_count    = serializers.IntegerField()
    seats_available     = serializers.IntegerField()
