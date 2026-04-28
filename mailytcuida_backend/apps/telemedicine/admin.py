from django.contrib import admin
from .models import VideoSession, SessionCheckin, SessionNote


class SessionCheckinInline(admin.StackedInline):
    model          = SessionCheckin
    extra          = 0
    readonly_fields = ('checked_in_at', 'pre_vitals', 'device_info')
    can_delete     = False


class SessionNoteInline(admin.StackedInline):
    model  = SessionNote
    extra  = 0
    readonly_fields = ('created_at', 'updated_at')


@admin.register(VideoSession)
class VideoSessionAdmin(admin.ModelAdmin):
    list_display   = ('appointment', 'provider', 'status', 'started_at',
                      'ended_at', 'duration_min', 'patient_rating')
    list_filter    = ('provider', 'status')
    search_fields  = ('appointment__patient__first_name', 'appointment__doctor__first_name')
    readonly_fields = ('id', 'started_at', 'ended_at', 'duration_min', 'created_at', 'updated_at')
    raw_id_fields  = ('appointment',)
    inlines        = [SessionCheckinInline, SessionNoteInline]
