from django.contrib import admin
from .models import VitalSign, VitalGoal


@admin.register(VitalSign)
class VitalSignAdmin(admin.ModelAdmin):
    list_display   = ('patient', 'vital_type', 'value', 'secondary_value', 'unit', 'source', 'recorded_at')
    list_filter    = ('vital_type', 'source')
    search_fields  = ('patient__first_name', 'patient__last_name')
    date_hierarchy = 'recorded_at'
    readonly_fields = ('created_at',)


@admin.register(VitalGoal)
class VitalGoalAdmin(admin.ModelAdmin):
    list_display  = ('patient', 'vital_type', 'min_value', 'max_value', 'is_active', 'set_by')
    list_filter   = ('vital_type', 'is_active')
    search_fields = ('patient__first_name', 'patient__last_name')
