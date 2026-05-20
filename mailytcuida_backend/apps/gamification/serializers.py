from rest_framework import serializers
from .models import PlayerProfile, PointTransaction, Badge, PlayerBadge, RewardProduct


class BadgeSerializer(serializers.ModelSerializer):
    category_display = serializers.CharField(source='get_category_display', read_only=True)

    class Meta:
        model  = Badge
        fields = [
            'id', 'code', 'name', 'description',
            'category', 'category_display', 'icon_url',
            'threshold', 'points_reward',
        ]


class PlayerBadgeSerializer(serializers.ModelSerializer):
    badge = BadgeSerializer(read_only=True)

    class Meta:
        model  = PlayerBadge
        fields = ['id', 'badge', 'earned_at']


class PointTransactionSerializer(serializers.ModelSerializer):
    source_display = serializers.CharField(source='get_source_display', read_only=True)

    class Meta:
        model  = PointTransaction
        fields = [
            'id', 'source', 'source_display',
            'base_points', 'multiplier', 'points',
            'note', 'created_at',
        ]


class PlayerProfileSerializer(serializers.ModelSerializer):
    badges       = PlayerBadgeSerializer(source='earned_badges', many=True, read_only=True)
    multiplier   = serializers.SerializerMethodField()

    class Meta:
        model  = PlayerProfile
        fields = [
            'id', 'total_points', 'level',
            'current_streak', 'longest_streak',
            'last_activity_date', 'multiplier',
            'badges', 'created_at', 'updated_at',
        ]

    def get_multiplier(self, obj):
        from .models import PLAN_MULTIPLIERS
        try:
            tier = obj.patient.user.subscription.plan.tier
        except Exception:
            tier = 'FREE'
        return PLAN_MULTIPLIERS.get(tier, 1)


class RewardProductSerializer(serializers.ModelSerializer):
    class Meta:
        model  = RewardProduct
        fields = [
            'id', 'name', 'description', 'image_url',
            'points_cost', 'stock', 'is_active',
        ]


class LeaderboardEntrySerializer(serializers.ModelSerializer):
    patient_name = serializers.SerializerMethodField()
    avatar_url   = serializers.CharField(source='patient.avatar_url', default='')

    class Meta:
        model  = PlayerProfile
        fields = ['id', 'patient_name', 'avatar_url',
                  'total_points', 'level', 'current_streak']

    def get_patient_name(self, obj):
        return f'{obj.patient.first_name} {obj.patient.last_name}'
