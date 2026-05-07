from django.contrib import admin
from .models import FamilyCareLink, VitalMonitorConfig, CareAlert, MedicationPayment


@admin.register(FamilyCareLink)
class FamilyCareLinkAdmin(admin.ModelAdmin):
    list_display = ['caregiver', 'patient', 'relationship_type', 'status', 'requested_at']
    list_filter = ['status', 'relationship_type']
    search_fields = ['caregiver__email', 'patient__email']


@admin.register(VitalMonitorConfig)
class VitalMonitorConfigAdmin(admin.ModelAdmin):
    list_display = ['care_link', 'vital_type', 'reminder_frequency_hours', 'is_active', 'last_patient_reading_at']
    list_filter = ['vital_type', 'is_active']


@admin.register(CareAlert)
class CareAlertAdmin(admin.ModelAdmin):
    list_display = ['care_link', 'alert_type', 'severity', 'status', 'created_at']
    list_filter = ['alert_type', 'severity', 'status']


@admin.register(MedicationPayment)
class MedicationPaymentAdmin(admin.ModelAdmin):
    list_display = ['care_link', 'description', 'amount_mxn', 'status', 'created_at']
    list_filter = ['status']
