from rest_framework import serializers

from .models import (
    DailyNutritionSummary,
    FoodEntry,
    MealSlot,
    NutritionPlan,
    NutritionPlanAssignment,
)


# ── Plan & Slots ──────────────────────────────────────────────────────────────

class MealSlotSerializer(serializers.ModelSerializer):
    class Meta:
        model = MealSlot
        fields = [
            'id', 'meal_type', 'day_number', 'name', 'description',
            'kcal', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g',
        ]
        read_only_fields = ['id']


class NutritionPlanSerializer(serializers.ModelSerializer):
    meal_slots = MealSlotSerializer(many=True, read_only=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = NutritionPlan
        fields = [
            'id', 'title', 'description', 'goal',
            'target_kcal', 'target_protein_g', 'target_carbs_g',
            'target_fat_g', 'target_fiber_g', 'target_sodium_mg',
            'duration_days', 'is_active',
            'created_by', 'created_by_name', 'created_at',
            'meal_slots',
        ]
        read_only_fields = ['id', 'created_by', 'created_at']

    def get_created_by_name(self, obj):
        if obj.created_by:
            return f'{obj.created_by.first_name} {obj.created_by.last_name}'.strip()
        return None


class NutritionPlanWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = NutritionPlan
        fields = [
            'title', 'description', 'goal',
            'target_kcal', 'target_protein_g', 'target_carbs_g',
            'target_fat_g', 'target_fiber_g', 'target_sodium_mg',
            'duration_days', 'is_active',
        ]


# ── Assignment ────────────────────────────────────────────────────────────────

class NutritionPlanAssignmentSerializer(serializers.ModelSerializer):
    plan_title = serializers.CharField(source='plan.title', read_only=True)
    plan_detail = NutritionPlanSerializer(source='plan', read_only=True)

    class Meta:
        model = NutritionPlanAssignment
        fields = [
            'id', 'plan', 'plan_title', 'plan_detail',
            'patient', 'assigned_by',
            'start_date', 'end_date', 'is_active', 'notes', 'created_at',
        ]
        read_only_fields = ['id', 'assigned_by', 'created_at']


class NutritionPlanAssignmentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = NutritionPlanAssignment
        fields = ['plan', 'patient', 'start_date', 'end_date', 'notes']


# ── Food Diary ────────────────────────────────────────────────────────────────

class FoodEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = FoodEntry
        fields = [
            'id', 'logged_at', 'meal_type', 'meal_slot',
            'food_name', 'quantity_g',
            'kcal', 'protein_g', 'carbs_g', 'fat_g', 'fiber_g', 'sodium_mg',
            'note', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def validate_quantity_g(self, value):
        if value <= 0:
            raise serializers.ValidationError('La cantidad debe ser mayor a 0.')
        return value


# ── Daily Summary ─────────────────────────────────────────────────────────────

class DailyNutritionSummarySerializer(serializers.ModelSerializer):
    class Meta:
        model = DailyNutritionSummary
        fields = [
            'id', 'date',
            'total_kcal', 'total_protein_g', 'total_carbs_g',
            'total_fat_g', 'total_fiber_g', 'total_sodium_mg',
            'entry_count',
            'plan_assignment', 'kcal_target', 'kcal_pct',
            'computed_at',
        ]
        read_only_fields = fields
