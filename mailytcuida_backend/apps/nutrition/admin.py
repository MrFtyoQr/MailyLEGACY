from django.contrib import admin

from .models import (
    DailyNutritionSummary,
    FoodEntry,
    MealSlot,
    NutritionPlan,
    NutritionPlanAssignment,
)


class MealSlotInline(admin.TabularInline):
    model = MealSlot
    extra = 1
    fields = ('day_number', 'meal_type', 'name', 'kcal', 'protein_g', 'carbs_g', 'fat_g')


@admin.register(NutritionPlan)
class NutritionPlanAdmin(admin.ModelAdmin):
    list_display = ('title', 'goal', 'target_kcal', 'duration_days', 'is_active', 'created_by', 'created_at')
    list_filter = ('goal', 'is_active')
    search_fields = ('title', 'description')
    readonly_fields = ('id', 'created_at')
    inlines = [MealSlotInline]


@admin.register(NutritionPlanAssignment)
class NutritionPlanAssignmentAdmin(admin.ModelAdmin):
    list_display = ('plan', 'patient', 'assigned_by', 'start_date', 'end_date', 'is_active')
    list_filter = ('is_active',)
    search_fields = ('plan__title', 'patient__user__email')
    readonly_fields = ('id', 'created_at')
    date_hierarchy = 'start_date'


@admin.register(FoodEntry)
class FoodEntryAdmin(admin.ModelAdmin):
    list_display = ('food_name', 'patient', 'meal_type', 'quantity_g', 'kcal', 'logged_at')
    list_filter = ('meal_type',)
    search_fields = ('food_name', 'patient__user__email')
    readonly_fields = ('id', 'created_at')
    date_hierarchy = 'logged_at'


@admin.register(DailyNutritionSummary)
class DailyNutritionSummaryAdmin(admin.ModelAdmin):
    list_display = ('patient', 'date', 'total_kcal', 'kcal_target', 'kcal_pct', 'entry_count', 'computed_at')
    list_filter = ('date',)
    search_fields = ('patient__user__email',)
    readonly_fields = ('id', 'computed_at')
    date_hierarchy = 'date'
