from rest_framework import serializers
from .models import Coupon, CouponRedemption


class CouponSerializer(serializers.ModelSerializer):
    discount_type_display = serializers.CharField(source='get_discount_type_display', read_only=True)
    is_exhausted          = serializers.BooleanField(read_only=True)

    class Meta:
        model  = Coupon
        fields = [
            'id', 'code', 'description',
            'discount_type', 'discount_type_display', 'discount_value',
            'valid_from', 'valid_until',
            'max_uses', 'max_uses_per_user', 'uses_count',
            'allowed_plans', 'first_time_only',
            'stripe_coupon_id', 'stripe_promotion_id',
            'is_active', 'is_exhausted', 'created_at',
        ]
        read_only_fields = ['id', 'uses_count', 'created_at']

    def validate_code(self, value):
        return value.upper().strip()

    def validate_discount_value(self, value):
        if value <= 0:
            raise serializers.ValidationError('El descuento debe ser mayor a 0.')
        return value


class CouponValidateSerializer(serializers.Serializer):
    """Used by the patient to check a coupon before checkout."""
    code      = serializers.CharField(max_length=32)
    plan_tier = serializers.ChoiceField(choices=['FREE', 'SILVER', 'GOLD', 'PLATINUM'])


class CouponValidateResponseSerializer(serializers.Serializer):
    valid             = serializers.BooleanField()
    discount_type     = serializers.CharField()
    discount_value    = serializers.DecimalField(max_digits=8, decimal_places=2)
    description       = serializers.CharField()
    stripe_promotion_id = serializers.CharField()
    error             = serializers.CharField(required=False)


class CouponRedemptionSerializer(serializers.ModelSerializer):
    coupon_code = serializers.CharField(source='coupon.code', read_only=True)

    class Meta:
        model  = CouponRedemption
        fields = [
            'id', 'coupon_code', 'discount_type', 'discount_value',
            'stripe_session_id', 'redeemed_at',
        ]
        read_only_fields = fields
