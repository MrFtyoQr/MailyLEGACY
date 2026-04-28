from rest_framework import serializers
from .models import AuditLog


class AuditLogSerializer(serializers.ModelSerializer):
    class Meta:
        model  = AuditLog
        fields = [
            'id', 'actor_email', 'actor_role',
            'action', 'resource_type', 'resource_id',
            'patient', 'ip_address', 'endpoint', 'http_status',
            'changed_fields', 'note', 'created_at',
        ]
        read_only_fields = fields
