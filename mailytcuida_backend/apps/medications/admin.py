from django.contrib import admin
from .models import Medication, MedicationPattern, MedicationSchedule, MealSchedule, MedicationHistory


class MedicationPatternInline(admin.TabularInline):
    model = MedicationPattern
    extra = 0
    fields = ('pattern_type', 'is_active', 'repeat_every_days', 'specific_days_of_week')


class MedicationScheduleInline(admin.TabularInline):
    model = MedicationSchedule
    extra = 0
    fields = ('time', 'is_relative_to_meal', 'meal_type', 'offset_minutes', 'is_active')


@admin.register(Medication)
class MedicationAdmin(admin.ModelAdmin):
    list_display  = ('name', 'patient', 'dosage', 'unit', 'is_active', 'created_at')
    list_filter   = ('is_active',)
    search_fields = ('name', 'active_compound', 'patient__first_name', 'patient__last_name')
    inlines       = [MedicationPatternInline, MedicationScheduleInline]


@admin.register(MealSchedule)
class MealScheduleAdmin(admin.ModelAdmin):
    list_display  = ('patient', 'meal_type', 'time', 'is_active', 'is_default')
    list_filter   = ('meal_type', 'is_active')
    search_fields = ('patient__first_name', 'patient__last_name')


@admin.register(MedicationHistory)
class MedicationHistoryAdmin(admin.ModelAdmin):
    list_display  = ('medication_name', 'patient', 'scheduled_at', 'status', 'actual_taken_at')
    list_filter   = ('status',)
    search_fields = ('medication_name', 'patient__first_name', 'patient__last_name')
    date_hierarchy = 'scheduled_at'
