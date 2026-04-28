from rest_framework import serializers
from .models import DeviceToken, Notification


class DeviceTokenSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeviceToken
        fields = ['id', 'token', 'platform', 'is_active', 'created_at']
        read_only_fields = ['id', 'is_active', 'created_at']

    def create(self, validated_data):
        user = self.context['request'].user
        # Upsert: if token already exists for this user, reactivate it
        obj, _ = DeviceToken.objects.update_or_create(
            user=user,
            token=validated_data['token'],
            defaults={
                'platform':  validated_data['platform'],
                'is_active': True,
            },
        )
        return obj


class NotificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Notification
        fields = [
            'id', 'code', 'channel', 'title', 'body',
            'data', 'status', 'sent_at', 'read_at', 'created_at',
        ]
        read_only_fields = fields


class UnreadCountSerializer(serializers.Serializer):
    unread = serializers.IntegerField()
