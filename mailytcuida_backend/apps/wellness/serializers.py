from rest_framework import serializers

from .models import (
    ActivityCompletion,
    DailyCheckin,
    MoodEntry,
    ProgramEnrollment,
    SleepEntry,
    WellnessActivity,
    WellnessProgram,
)


# ── Program & Activities ──────────────────────────────────────────────────────

class WellnessActivitySerializer(serializers.ModelSerializer):
    class Meta:
        model = WellnessActivity
        fields = [
            'id', 'order', 'day_number', 'title', 'activity_type',
            'content_url', 'body', 'duration_min', 'points_reward',
        ]
        read_only_fields = ['id']


class WellnessProgramSerializer(serializers.ModelSerializer):
    activities = WellnessActivitySerializer(many=True, read_only=True)
    created_by_name = serializers.SerializerMethodField()
    activity_count = serializers.SerializerMethodField()

    class Meta:
        model = WellnessProgram
        fields = [
            'id', 'title', 'description', 'category',
            'duration_days', 'thumbnail_url', 'is_active',
            'created_by', 'created_by_name', 'created_at',
            'activity_count', 'activities',
        ]
        read_only_fields = ['id', 'created_by', 'created_at']

    def get_created_by_name(self, obj):
        if obj.created_by:
            return f'{obj.created_by.first_name} {obj.created_by.last_name}'.strip()
        return None

    def get_activity_count(self, obj):
        return obj.activities.count()


class WellnessProgramWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = WellnessProgram
        fields = ['title', 'description', 'category', 'duration_days', 'thumbnail_url', 'is_active']


# ── Enrollment ────────────────────────────────────────────────────────────────

class ProgramEnrollmentSerializer(serializers.ModelSerializer):
    program_title = serializers.CharField(source='program.title', read_only=True)
    progress_pct = serializers.SerializerMethodField()

    class Meta:
        model = ProgramEnrollment
        fields = [
            'id', 'program', 'program_title', 'patient', 'enrolled_by',
            'status', 'start_date', 'completed_at', 'created_at',
            'progress_pct',
        ]
        read_only_fields = ['id', 'enrolled_by', 'created_at', 'completed_at']

    def get_progress_pct(self, obj):
        total = obj.program.activities.count()
        if not total:
            return 0
        done = obj.completions.count()
        return round(done / total * 100, 1)


class ProgramEnrollmentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProgramEnrollment
        fields = ['program', 'patient', 'start_date']


# ── Activity Completion ───────────────────────────────────────────────────────

class ActivityCompletionSerializer(serializers.ModelSerializer):
    class Meta:
        model = ActivityCompletion
        fields = ['id', 'enrollment', 'activity', 'completed_at', 'note']
        read_only_fields = ['id', 'completed_at']


# ── Mood ──────────────────────────────────────────────────────────────────────

class MoodEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = MoodEntry
        fields = [
            'id', 'logged_at', 'score', 'label', 'tags', 'note', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def validate_score(self, value):
        if not (1 <= value <= 10):
            raise serializers.ValidationError('El puntaje debe estar entre 1 y 10.')
        return value


# ── Sleep ─────────────────────────────────────────────────────────────────────

class SleepEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = SleepEntry
        fields = [
            'id', 'sleep_date', 'bedtime', 'wake_time',
            'duration_hours', 'quality', 'interruptions', 'note', 'created_at',
        ]
        read_only_fields = ['id', 'created_at']

    def validate_duration_hours(self, value):
        if value <= 0 or value > 24:
            raise serializers.ValidationError('Las horas de sueño deben estar entre 0 y 24.')
        return value


# ── Daily Check-in ────────────────────────────────────────────────────────────

class DailyCheckinSerializer(serializers.ModelSerializer):
    class Meta:
        model = DailyCheckin
        fields = [
            'id', 'date', 'mood_score', 'mood_label',
            'sleep_hours', 'sleep_quality',
            'activities_completed', 'updated_at',
        ]
        read_only_fields = fields
