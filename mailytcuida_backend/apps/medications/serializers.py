from rest_framework import serializers
from .models import Medication, MedicationPattern, MedicationSchedule, MealSchedule, MedicationHistory


class MedicationPatternSerializer(serializers.ModelSerializer):
    class Meta:
        model = MedicationPattern
        fields = [
            'id', 'pattern_type', 'is_active',
            'repeat_every_days', 'repeat_for_days',
            'specific_days_of_week',
            'pause_start_date', 'pause_end_date',
            'pause_duration_days', 'pause_interval_days',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate_specific_days_of_week(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError('Debe ser una lista.')
        for day in value:
            if day not in range(7):
                raise serializers.ValidationError('Cada día debe ser un entero entre 0 y 6.')
        return value

    def validate(self, attrs):
        pattern_type = attrs.get('pattern_type', getattr(self.instance, 'pattern_type', None))
        if pattern_type == MedicationPattern.PatternType.SPECIFIC_DAYS:
            days = attrs.get('specific_days_of_week', getattr(self.instance, 'specific_days_of_week', []))
            if not days:
                raise serializers.ValidationError(
                    {'specific_days_of_week': 'Requerido para patrón SPECIFIC_DAYS.'}
                )
        if pattern_type == MedicationPattern.PatternType.CUSTOM:
            every = attrs.get('repeat_every_days', getattr(self.instance, 'repeat_every_days', None))
            if not every:
                raise serializers.ValidationError(
                    {'repeat_every_days': 'Requerido para patrón CUSTOM.'}
                )
        return attrs


class MedicationScheduleSerializer(serializers.ModelSerializer):
    class Meta:
        model = MedicationSchedule
        fields = [
            'id', 'pattern', 'time',
            'is_relative_to_meal', 'meal_type', 'offset_minutes',
            'reminder_minutes_before', 'is_active', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def validate(self, attrs):
        is_relative = attrs.get('is_relative_to_meal', getattr(self.instance, 'is_relative_to_meal', False))
        if is_relative:
            meal_type = attrs.get('meal_type', getattr(self.instance, 'meal_type', ''))
            if not meal_type:
                raise serializers.ValidationError(
                    {'meal_type': 'Requerido cuando is_relative_to_meal es True.'}
                )
        return attrs


class MedicationSerializer(serializers.ModelSerializer):
    patterns  = MedicationPatternSerializer(many=True, read_only=True)
    schedules = MedicationScheduleSerializer(many=True, read_only=True)

    class Meta:
        model = Medication
        fields = [
            'id', 'name', 'active_compound', 'dosage', 'unit',
            'notes', 'is_active', 'created_at', 'updated_at',
            'patterns', 'schedules',
        ]
        read_only_fields = ['id', 'is_active', 'created_at', 'updated_at']


class MedicationWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Medication
        fields = ['id', 'name', 'active_compound', 'dosage', 'unit', 'notes']
        read_only_fields = ['id']


class MealScheduleSerializer(serializers.ModelSerializer):
    class Meta:
        model = MealSchedule
        fields = [
            'id', 'meal_name', 'meal_type', 'time',
            'is_active', 'is_default', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class MedicationHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = MedicationHistory
        fields = [
            'id', 'medication', 'medication_name', 'schedule',
            'scheduled_at', 'actual_taken_at', 'reminder_sent_at',
            'status', 'dosage_taken', 'notes', 'side_effects', 'created_at',
        ]
        read_only_fields = [
            'id', 'medication_name', 'scheduled_at',
            'reminder_sent_at', 'created_at',
        ]


class TakeActionSerializer(serializers.Serializer):
    dosage_taken = serializers.CharField(max_length=100, required=False, allow_blank=True)
    notes        = serializers.CharField(required=False, allow_blank=True)
    side_effects = serializers.CharField(required=False, allow_blank=True)


class SkipActionSerializer(serializers.Serializer):
    notes = serializers.CharField(required=False, allow_blank=True)


class PostponeActionSerializer(serializers.Serializer):
    minutes = serializers.IntegerField(min_value=1, max_value=1440)
    notes   = serializers.CharField(required=False, allow_blank=True)
