from rest_framework import serializers
from .models import VitalSign, VitalGoal


class VitalSignSerializer(serializers.ModelSerializer):
    class Meta:
        model = VitalSign
        fields = [
            'id', 'vital_type', 'value', 'secondary_value',
            'unit', 'source', 'notes', 'recorded_at', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def validate(self, attrs):
        vital_type = attrs.get('vital_type', getattr(self.instance, 'vital_type', None))
        secondary  = attrs.get('secondary_value', getattr(self.instance, 'secondary_value', None))

        if vital_type == VitalSign.VitalType.BLOOD_PRESSURE and not secondary:
            raise serializers.ValidationError(
                {'secondary_value': 'Requerido para presión arterial (diastólica).'}
            )
        if vital_type != VitalSign.VitalType.BLOOD_PRESSURE and secondary is not None:
            raise serializers.ValidationError(
                {'secondary_value': 'secondary_value solo aplica para BLOOD_PRESSURE.'}
            )

        value = attrs.get('value', getattr(self.instance, 'value', None))
        if value is not None and value < 0:
            raise serializers.ValidationError({'value': 'El valor no puede ser negativo.'})

        return attrs


class VitalGoalSerializer(serializers.ModelSerializer):
    class Meta:
        model = VitalGoal
        fields = [
            'id', 'vital_type',
            'min_value', 'max_value',
            'min_secondary', 'max_secondary',
            'notes', 'is_active', 'set_by',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'set_by', 'created_at', 'updated_at']

    def validate(self, attrs):
        min_v = attrs.get('min_value', getattr(self.instance, 'min_value', None))
        max_v = attrs.get('max_value', getattr(self.instance, 'max_value', None))
        if min_v is not None and max_v is not None and min_v >= max_v:
            raise serializers.ValidationError(
                {'min_value': 'min_value debe ser menor que max_value.'}
            )
        return attrs


class VitalLatestSerializer(serializers.Serializer):
    """Returns the latest reading per vital type."""
    vital_type   = serializers.CharField()
    value        = serializers.DecimalField(max_digits=8, decimal_places=2)
    secondary_value = serializers.DecimalField(max_digits=8, decimal_places=2, allow_null=True)
    unit         = serializers.CharField()
    recorded_at  = serializers.DateTimeField()


class VitalSummarySerializer(serializers.Serializer):
    """Summary statistics per vital type over a time window."""
    vital_type = serializers.CharField()
    unit       = serializers.CharField()
    count      = serializers.IntegerField()
    min_value  = serializers.DecimalField(max_digits=8, decimal_places=2, allow_null=True)
    max_value  = serializers.DecimalField(max_digits=8, decimal_places=2, allow_null=True)
    avg_value  = serializers.DecimalField(max_digits=8, decimal_places=2, allow_null=True)
    last_value = serializers.DecimalField(max_digits=8, decimal_places=2, allow_null=True)
    last_recorded_at = serializers.DateTimeField(allow_null=True)
