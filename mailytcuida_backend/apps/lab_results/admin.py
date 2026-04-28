from django.contrib import admin
from .models import LabPanel, LabResult, LabRec


class LabResultInline(admin.TabularInline):
    model = LabResult
    extra = 0
    fields = ('parameter', 'value', 'unit', 'ref_min', 'ref_max', 'status')
    readonly_fields = ('status',)


class LabRecInline(admin.TabularInline):
    model = LabRec
    extra = 0
    fields = ('rec_type', 'message')


@admin.register(LabPanel)
class LabPanelAdmin(admin.ModelAdmin):
    list_display   = ('patient', 'panel_name', 'lab_name', 'performed_at', 'source')
    list_filter    = ('source',)
    search_fields  = ('patient__first_name', 'patient__last_name', 'lab_name', 'panel_name')
    date_hierarchy = 'performed_at'
    inlines        = [LabResultInline]


@admin.register(LabResult)
class LabResultAdmin(admin.ModelAdmin):
    list_display   = ('patient', 'parameter', 'value', 'unit', 'status', 'performed_at')
    list_filter    = ('status',)
    search_fields  = ('patient__first_name', 'patient__last_name', 'parameter')
    date_hierarchy = 'performed_at'
    readonly_fields = ('status',)
    inlines        = [LabRecInline]
