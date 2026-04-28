from django.contrib import admin

from .models import (
    QuestionAnswer,
    Survey,
    SurveyAssignment,
    SurveyQuestion,
    SurveyResponse,
)


class SurveyQuestionInline(admin.TabularInline):
    model = SurveyQuestion
    extra = 1
    fields = ('order', 'text', 'question_type', 'options', 'is_required')


@admin.register(Survey)
class SurveyAdmin(admin.ModelAdmin):
    list_display = ('title', 'category', 'estimated_minutes', 'is_active', 'created_by', 'created_at')
    list_filter = ('category', 'is_active')
    search_fields = ('title', 'description')
    readonly_fields = ('id', 'created_at')
    inlines = [SurveyQuestionInline]


@admin.register(SurveyAssignment)
class SurveyAssignmentAdmin(admin.ModelAdmin):
    list_display = ('survey', 'patient', 'assigned_by', 'due_date', 'completed', 'created_at')
    list_filter = ('completed',)
    search_fields = ('survey__title', 'patient__user__email')
    readonly_fields = ('id', 'created_at', 'completed_at')
    date_hierarchy = 'created_at'


class QuestionAnswerInline(admin.TabularInline):
    model = QuestionAnswer
    extra = 0
    readonly_fields = ('question', 'value')
    can_delete = False


@admin.register(SurveyResponse)
class SurveyResponseAdmin(admin.ModelAdmin):
    list_display = ('assignment', 'submitted_at', 'score', 'score_label')
    readonly_fields = ('id', 'submitted_at')
    inlines = [QuestionAnswerInline]
