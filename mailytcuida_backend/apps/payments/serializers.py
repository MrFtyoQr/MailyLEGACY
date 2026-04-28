from rest_framework import serializers
from .models import Plan, Subscription


class PlanSerializer(serializers.ModelSerializer):
    ai_model = serializers.CharField(read_only=True)

    class Meta:
        model = Plan
        fields = [
            'tier', 'name', 'price_mxn', 'max_doctors',
            'features', 'ai_model', 'is_active',
        ]


class SubscriptionSerializer(serializers.ModelSerializer):
    plan   = PlanSerializer(read_only=True)
    tier   = serializers.CharField(source='plan.tier', read_only=True)

    class Meta:
        model = Subscription
        fields = [
            'id', 'plan', 'tier', 'status',
            'current_period_start', 'current_period_end',
            'cancel_at_period_end', 'created_at', 'updated_at',
        ]
        read_only_fields = fields


class CheckoutSerializer(serializers.Serializer):
    tier         = serializers.ChoiceField(choices=['SILVER', 'GOLD', 'PLATINUM'])
    success_url  = serializers.URLField()
    cancel_url   = serializers.URLField()


class PortalSerializer(serializers.Serializer):
    return_url = serializers.URLField()
