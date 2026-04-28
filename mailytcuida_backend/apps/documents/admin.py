from django.contrib import admin
from .models import MedicalDocument, DocumentShare, HealthSummaryExport


@admin.register(MedicalDocument)
class MedicalDocumentAdmin(admin.ModelAdmin):
    list_display   = ('title', 'patient', 'category', 'status', 'document_date',
                      'file_size', 'is_active', 'created_at')
    list_filter    = ('category', 'status', 'is_active')
    search_fields  = ('title', 'patient__first_name', 'patient__last_name')
    date_hierarchy = 'created_at'
    readonly_fields = ('id', 'ocr_text', 'ocr_data', 'created_at', 'updated_at')
    raw_id_fields  = ('patient',)


@admin.register(DocumentShare)
class DocumentShareAdmin(admin.ModelAdmin):
    list_display  = ('document', 'doctor', 'is_active', 'shared_at', 'revoked_at')
    list_filter   = ('is_active',)
    raw_id_fields = ('document', 'doctor')


@admin.register(HealthSummaryExport)
class HealthSummaryExportAdmin(admin.ModelAdmin):
    list_display   = ('patient', 'status', 'sections', 'created_at', 'completed_at')
    list_filter    = ('status',)
    readonly_fields = ('id', 'pdf_url', 'created_at', 'completed_at')
    raw_id_fields  = ('patient',)
