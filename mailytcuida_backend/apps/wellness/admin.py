from django.contrib import admin

from .models import (
    ActivityCompletion,
    DailyCheckin,
    MoodEntry,
    ProgramEnrollment,
    SleepEntry,
    WellnessActivity,
    WellnessProgram,
)


class WellnessActivityInline(admin.TabularInline):
    model = WellnessActivity
    extra = 1
    fields = ('day_number', 'order', 'title', 'activity_type', 'duration_min', 'points_reward')


@admin.register(WellnessProgram)
class WellnessProgramAdmin(admin.ModelAdmin):
    list_display = ('title', 'category', 'duration_days', 'is_active', 'created_by', 'created_at')
    list_filter = ('category', 'is_active')
    search_fields = ('title', 'description')
    readonly_fields = ('id', 'created_at')
    inlines = [WellnessActivityInline]


class ActivityCompletionInline(admin.TabularInline):
    model = ActivityCompletion
    extra = 0
    readonly_fields = ('activity', 'completed_at', 'note')
    can_delete = False


@admin.register(ProgramEnrollment)
class ProgramEnrollmentAdmin(admin.ModelAdmin):
    list_display = ('patient', 'program', 'status', 'start_date', 'completed_at')
    list_filter = ('status',)
    search_fields = ('patient__user__email', 'program__title')
    readonly_fields = ('id', 'created_at', 'completed_at')
    inlines = [ActivityCompletionInline]


@admin.register(MoodEntry)
class MoodEntryAdmin(admin.ModelAdmin):
    list_display = ('patient', 'score', 'label', 'logged_at')
    list_filter = ('label',)
    search_fields = ('patient__user__email',)
    readonly_fields = ('id', 'created_at')
    date_hierarchy = 'logged_at'


@admin.register(SleepEntry)
class SleepEntryAdmin(admin.ModelAdmin):
    list_display = ('patient', 'sleep_date', 'duration_hours', 'quality', 'interruptions')
    list_filter = ('quality',)
    search_fields = ('patient__user__email',)
    readonly_fields = ('id', 'created_at')
    date_hierarchy = 'sleep_date'


@admin.register(DailyCheckin)
class DailyCheckinAdmin(admin.ModelAdmin):
    list_display = ('patient', 'date', 'mood_score', 'mood_label', 'sleep_hours', 'sleep_quality', 'activities_completed', 'updated_at')
    search_fields = ('patient__user__email',)
    readonly_fields = ('id', 'updated_at')
    date_hierarchy = 'date'
