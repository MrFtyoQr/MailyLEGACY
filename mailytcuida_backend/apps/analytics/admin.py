from django.contrib import admin
from .models import AdherenceReport, HealthInsight


@admin.register(AdherenceReport)
class AdherenceReportAdmin(admin.ModelAdmin):
    list_display   = ('patient', 'period', 'period_start', 'period_end',
                      'adherence_pct', 'total_doses', 'taken_doses')
    list_filter    = ('period',)
    search_fields  = ('patient__first_name', 'patient__last_name')
    date_hierarchy = 'period_start'
    readonly_fields = ('created_at',)


@admin.register(HealthInsight)
class HealthInsightAdmin(admin.ModelAdmin):
    list_display   = ('patient', 'insight_type', 'provider', 'model_used',
                      'summary', 'created_at')
    list_filter    = ('insight_type', 'provider')
    search_fields  = ('patient__first_name', 'patient__last_name', 'summary')
    date_hierarchy = 'created_at'
    readonly_fields = ('context_hash', 'created_at')
