from rest_framework import serializers
from .models import LabPanel, LabResult, LabRec


class LabRecSerializer(serializers.ModelSerializer):
    class Meta:
        model = LabRec
        fields = ['id', 'rec_type', 'message', 'created_at']
        read_only_fields = ['id', 'created_at']


class LabResultSerializer(serializers.ModelSerializer):
    recommendations = LabRecSerializer(many=True, read_only=True)
    status          = serializers.CharField(read_only=True)

    class Meta:
        model = LabResult
        fields = [
            'id', 'panel', 'parameter', 'parameter_code',
            'value', 'unit', 'ref_min', 'ref_max', 'ref_text',
            'status', 'performed_at', 'notes',
            'recommendations', 'created_at',
        ]
        read_only_fields = ['id', 'status', 'created_at']

    def validate_value(self, value):
        if value < 0:
            raise serializers.ValidationError('El valor no puede ser negativo.')
        return value

    def validate(self, attrs):
        ref_min = attrs.get('ref_min', getattr(self.instance, 'ref_min', None))
        ref_max = attrs.get('ref_max', getattr(self.instance, 'ref_max', None))
        if ref_min is not None and ref_max is not None and ref_min >= ref_max:
            raise serializers.ValidationError(
                {'ref_min': 'ref_min debe ser menor que ref_max.'}
            )
        return attrs


class LabResultWriteSerializer(serializers.ModelSerializer):
    """Slim write serializer — excludes nested read-only fields."""
    class Meta:
        model = LabResult
        fields = [
            'panel', 'parameter', 'parameter_code',
            'value', 'unit', 'ref_min', 'ref_max', 'ref_text',
            'performed_at', 'notes',
        ]

    def validate_value(self, value):
        if value < 0:
            raise serializers.ValidationError('El valor no puede ser negativo.')
        return value


class LabPanelSerializer(serializers.ModelSerializer):
    results = LabResultSerializer(many=True, read_only=True)

    class Meta:
        model = LabPanel
        fields = [
            'id', 'lab_name', 'panel_name', 'performed_at',
            'source', 'file_url', 'notes',
            'results', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'created_at', 'updated_at']


class LabPanelWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = LabPanel
        fields = ['lab_name', 'panel_name', 'performed_at', 'source', 'file_url', 'notes']


class LabSummaryItemSerializer(serializers.Serializer):
    """Latest value per parameter."""
    parameter    = serializers.CharField()
    value        = serializers.DecimalField(max_digits=10, decimal_places=3)
    unit         = serializers.CharField()
    status       = serializers.CharField()
    performed_at = serializers.DateField()


class LabScanSerializer(serializers.Serializer):
    """OCR scan upload — placeholder."""
    file = serializers.FileField()
