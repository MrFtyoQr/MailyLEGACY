from django.contrib import admin
from .models import Appointment, AppointmentNote


class AppointmentNoteInline(admin.StackedInline):
    model = AppointmentNote
    extra = 0
    fields = ('chief_complaint', 'diagnosis', 'treatment_plan', 'follow_up_days', 'prescriptions')


@admin.register(Appointment)
class AppointmentAdmin(admin.ModelAdmin):
    list_display   = ('patient', 'doctor', 'appointment_type', 'status', 'scheduled_at')
    list_filter    = ('status', 'appointment_type')
    search_fields  = (
        'patient__first_name', 'patient__last_name',
        'doctor__first_name', 'doctor__last_name',
    )
    date_hierarchy = 'scheduled_at'
    readonly_fields = ('created_at', 'updated_at', 'cancelled_by')
    inlines        = [AppointmentNoteInline]


@admin.register(AppointmentNote)
class AppointmentNoteAdmin(admin.ModelAdmin):
    list_display  = ('appointment', 'created_at', 'updated_at')
    search_fields = ('appointment__patient__first_name', 'diagnosis')
