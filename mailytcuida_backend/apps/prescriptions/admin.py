from django.contrib import admin
from .models import Prescription, PrescriptionVerification


class PrescriptionVerificationInline(admin.StackedInline):
    model  = PrescriptionVerification
    extra  = 0
    readonly_fields = ('token', 'verification_url', 'issued_by_name', 'issued_by_license',
                       'clinic_name', 'signature', 'is_valid', 'invalidated_at', 'created_at')
    can_delete = False


@admin.register(Prescription)
class PrescriptionAdmin(admin.ModelAdmin):
    list_display   = ('patient', 'title', 'source', 'status', 'prescribed_by',
                      'clinic_name', 'prescribed_at', 'expires_at', 'is_active')
    list_filter    = ('source', 'status', 'is_active')
    search_fields  = ('patient__first_name', 'patient__last_name',
                      'prescribed_by', 'clinic_name', 'mailysoft_id')
    date_hierarchy = 'prescribed_at'
    readonly_fields = ('id', 'source', 'mailysoft_id', 'mailysoft_doctor_id',
                       'mailysoft_clinic_id', 'created_at', 'updated_at')
    raw_id_fields  = ('patient',)
    inlines        = [PrescriptionVerificationInline]


@admin.register(PrescriptionVerification)
class PrescriptionVerificationAdmin(admin.ModelAdmin):
    list_display  = ('prescription', 'token', 'issued_by_name', 'is_valid',
                     'invalidated_at', 'created_at')
    list_filter   = ('is_valid',)
    search_fields = ('token', 'issued_by_name', 'issued_by_license')
    readonly_fields = ('id', 'token', 'prescription', 'signature', 'created_at')

    def has_add_permission(self, request):
        return False  # Only created via webhook
