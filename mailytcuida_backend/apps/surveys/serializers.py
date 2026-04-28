"""
Surveys serializers.

Role rules:
  - ADMIN / doctor can create surveys and assign them.
  - Patient can only read their own assignments and submit responses.
"""
from django.utils import timezone
from rest_framework import serializers

from .models import (
    QuestionAnswer,
    Survey,
    SurveyAssignment,
    SurveyQuestion,
    SurveyResponse,
)


# ── Survey & Questions ────────────────────────────────────────────────────────

class SurveyQuestionSerializer(serializers.ModelSerializer):
    class Meta:
        model = SurveyQuestion
        fields = [
            'id', 'order', 'text', 'question_type',
            'options', 'is_required',
            'scale_min_label', 'scale_max_label',
        ]
        read_only_fields = ['id']


class SurveySerializer(serializers.ModelSerializer):
    questions = SurveyQuestionSerializer(many=True, read_only=True)
    created_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Survey
        fields = [
            'id', 'title', 'description', 'category',
            'estimated_minutes', 'is_active',
            'created_by', 'created_by_name', 'created_at',
            'questions',
        ]
        read_only_fields = ['id', 'created_by', 'created_at']

    def get_created_by_name(self, obj):
        if obj.created_by:
            return f'{obj.created_by.first_name} {obj.created_by.last_name}'.strip()
        return None


class SurveyWriteSerializer(serializers.ModelSerializer):
    """Used for create/update — questions managed separately."""
    class Meta:
        model = Survey
        fields = ['title', 'description', 'category', 'estimated_minutes', 'is_active']


class SurveyQuestionWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = SurveyQuestion
        fields = [
            'order', 'text', 'question_type',
            'options', 'is_required',
            'scale_min_label', 'scale_max_label',
        ]

    def validate(self, data):
        qtype = data.get('question_type', '')
        if qtype in ('SINGLE_CHOICE', 'MULTI_CHOICE'):
            opts = data.get('options', [])
            if not opts or len(opts) < 2:
                raise serializers.ValidationError(
                    'SINGLE_CHOICE / MULTI_CHOICE require at least 2 options.'
                )
        return data


# ── Assignment ────────────────────────────────────────────────────────────────

class SurveyAssignmentSerializer(serializers.ModelSerializer):
    survey_title = serializers.CharField(source='survey.title', read_only=True)
    survey_detail = SurveySerializer(source='survey', read_only=True)

    class Meta:
        model = SurveyAssignment
        fields = [
            'id', 'survey', 'survey_title', 'survey_detail',
            'patient', 'assigned_by',
            'due_date', 'completed', 'completed_at', 'created_at',
        ]
        read_only_fields = ['id', 'completed', 'completed_at', 'created_at', 'assigned_by']


class SurveyAssignmentCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = SurveyAssignment
        fields = ['survey', 'patient', 'due_date']


# ── Response & Answers ────────────────────────────────────────────────────────

class QuestionAnswerSerializer(serializers.ModelSerializer):
    class Meta:
        model = QuestionAnswer
        fields = ['id', 'question', 'value']
        read_only_fields = ['id']


class SurveyResponseReadSerializer(serializers.ModelSerializer):
    answers = QuestionAnswerSerializer(many=True, read_only=True)

    class Meta:
        model = SurveyResponse
        fields = ['id', 'assignment', 'submitted_at', 'score', 'score_label', 'answers']


class SurveySubmitSerializer(serializers.Serializer):
    """
    Body: { "answers": [ {"question": "<uuid>", "value": <any>}, ... ] }
    Validates required questions are answered and value types match question_type.
    """
    answers = QuestionAnswerSerializer(many=True)

    def validate_answers(self, answers):
        if not answers:
            raise serializers.ValidationError('answers list cannot be empty.')
        question_ids = [a['question'].id if hasattr(a['question'], 'id') else a['question']
                        for a in answers]
        if len(question_ids) != len(set(str(q) for q in question_ids)):
            raise serializers.ValidationError('Duplicate question answers are not allowed.')
        return answers

    def validate(self, data):
        assignment = self.context['assignment']
        survey = assignment.survey
        required_ids = set(
            str(q.id) for q in survey.questions.filter(is_required=True)
        )
        answered_ids = set(
            str(a['question'].id if hasattr(a['question'], 'id') else a['question'])
            for a in data['answers']
        )
        missing = required_ids - answered_ids
        if missing:
            raise serializers.ValidationError(
                {'answers': f'Missing required questions: {missing}'}
            )
        return data

    def save(self):
        assignment = self.context['assignment']
        answers_data = self.validated_data['answers']

        response = SurveyResponse.objects.create(assignment=assignment)

        for ans in answers_data:
            QuestionAnswer.objects.create(
                response=response,
                question=ans['question'],
                value=ans['value'],
            )

        # Mark assignment completed
        assignment.completed = True
        assignment.completed_at = timezone.now()
        assignment.save(update_fields=['completed', 'completed_at'])

        return response
