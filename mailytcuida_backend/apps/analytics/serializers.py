from rest_framework import serializers
from .models import AdherenceReport, HealthInsight


class AdherenceReportSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdherenceReport
        fields = [
            'id', 'period', 'period_start', 'period_end',
            'total_doses', 'taken_doses', 'skipped_doses', 'postponed_doses',
            'adherence_pct', 'medications_tracked', 'created_at',
        ]
        read_only_fields = fields


class HealthInsightSerializer(serializers.ModelSerializer):
    class Meta:
        model = HealthInsight
        fields = [
            'id', 'insight_type', 'provider', 'model_used',
            'summary', 'detail', 'actions', 'created_at',
        ]
        read_only_fields = fields


class InsightGenerateSerializer(serializers.Serializer):
    insight_type = serializers.ChoiceField(choices=[
        'MEDICATION_ADHERENCE', 'VITAL_TREND', 'LAB_ANALYSIS', 'GENERAL_HEALTH',
    ])


class DashboardSerializer(serializers.Serializer):
    """Patient dashboard — assembled in the view, not a DB model."""
    adherence_7d       = serializers.DictField()
    latest_vitals      = serializers.ListField()
    active_medications = serializers.IntegerField()
    next_appointment   = serializers.DictField(allow_null=True)
    abnormal_labs      = serializers.IntegerField()
    last_insight       = HealthInsightSerializer(allow_null=True)
