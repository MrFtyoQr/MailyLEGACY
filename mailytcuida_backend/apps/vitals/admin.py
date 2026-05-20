from django.contrib import admin
from django.utils.html import format_html
from .models import VitalSign, VitalGoal


@admin.register(VitalSign)
class VitalSignAdmin(admin.ModelAdmin):
    list_display   = ('patient', 'vital_type', 'value', 'secondary_value', 'unit', 'source', 'recorded_at', 'has_photo')
    list_filter    = ('vital_type', 'source')
    search_fields  = ('patient__first_name', 'patient__last_name')
    date_hierarchy = 'recorded_at'
    readonly_fields = ('created_at', 'photo_preview')

    fieldsets = (
        (None, {
            'fields': ('patient', 'vital_type', 'value', 'secondary_value', 'unit', 'source', 'recorded_at', 'notes'),
        }),
        ('Evidencia fotográfica', {
            'fields': ('photo_url', 'photo_preview'),
        }),
        ('Metadatos', {
            'fields': ('created_at',),
            'classes': ('collapse',),
        }),
    )

    @admin.display(description='Foto', boolean=True)
    def has_photo(self, obj):
        return bool(obj.photo_url)

    @admin.display(description='Vista previa de evidencia')
    def photo_preview(self, obj):
        if obj.photo_url:
            return format_html(
                '<img src="{}" style="max-height:240px;max-width:400px;border-radius:8px;border:1px solid #ddd;" />',
                obj.photo_url,
            )
        return 'Sin foto de evidencia'


@admin.register(VitalGoal)
class VitalGoalAdmin(admin.ModelAdmin):
    list_display  = ('patient', 'vital_type', 'min_value', 'max_value', 'is_active', 'set_by')
    list_filter   = ('vital_type', 'is_active')
    search_fields = ('patient__first_name', 'patient__last_name')
