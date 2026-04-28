"""
Surveys views.

Permissions:
  ADMIN / doctor — full CRUD on surveys, can assign and read all responses.
  Patient        — read own assignments, submit response once.
"""
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import PatientProfile
from apps.audit.logger import audit, ResourceType
from apps.notifications.service import notify

from .models import Survey, SurveyAssignment, SurveyQuestion, SurveyResponse
from .serializers import (
    SurveyAssignmentCreateSerializer,
    SurveyAssignmentSerializer,
    SurveyQuestionWriteSerializer,
    SurveyResponseReadSerializer,
    SurveySerializer,
    SurveySubmitSerializer,
    SurveyWriteSerializer,
)


def _is_staff(user):
    return getattr(user, 'role', '') in ('ADMIN', 'DOCTOR')


# ── Survey templates ──────────────────────────────────────────────────────────

class SurveyListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = Survey.objects.prefetch_related('questions')
        if not _is_staff(self.request.user):
            qs = qs.filter(is_active=True)
        return qs

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return SurveyWriteSerializer
        return SurveySerializer

    def perform_create(self, serializer):
        if not _is_staff(self.request.user):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Only staff can create surveys.')
        survey = serializer.save(created_by=self.request.user)
        audit(
            request=self.request,
            action='CREATE',
            resource_type=ResourceType.OTHER,
            resource_id=str(survey.id),
            note=f'title={survey.title}',
        )


class SurveyDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    queryset = Survey.objects.prefetch_related('questions')

    def get_serializer_class(self):
        if self.request.method in ('PUT', 'PATCH'):
            return SurveyWriteSerializer
        return SurveySerializer

    def perform_update(self, serializer):
        if not _is_staff(self.request.user):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Only staff can update surveys.')
        serializer.save()

    def perform_destroy(self, instance):
        if not _is_staff(self.request.user):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Only staff can delete surveys.')
        instance.is_active = False
        instance.save(update_fields=['is_active'])


# ── Survey questions ──────────────────────────────────────────────────────────

class SurveyQuestionListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = SurveyQuestionWriteSerializer

    def get_survey(self):
        return get_object_or_404(Survey, pk=self.kwargs['survey_pk'])

    def get_queryset(self):
        return SurveyQuestion.objects.filter(survey_id=self.kwargs['survey_pk'])

    def perform_create(self, serializer):
        if not _is_staff(self.request.user):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Only staff can add questions.')
        survey = self.get_survey()
        serializer.save(survey=survey)


class SurveyQuestionDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = SurveyQuestionWriteSerializer

    def get_queryset(self):
        return SurveyQuestion.objects.filter(survey_id=self.kwargs['survey_pk'])

    def perform_update(self, serializer):
        if not _is_staff(self.request.user):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Only staff can edit questions.')
        serializer.save()

    def perform_destroy(self, instance):
        if not _is_staff(self.request.user):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Only staff can delete questions.')
        instance.delete()


# ── Assignments ───────────────────────────────────────────────────────────────

class AssignmentListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if _is_staff(user):
            return SurveyAssignment.objects.select_related('survey', 'patient__user').all()
        # Patient: own assignments only
        try:
            patient = PatientProfile.objects.get(user=user)
        except PatientProfile.DoesNotExist:
            return SurveyAssignment.objects.none()
        return SurveyAssignment.objects.filter(patient=patient).select_related('survey')

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return SurveyAssignmentCreateSerializer
        return SurveyAssignmentSerializer

    def perform_create(self, serializer):
        if not _is_staff(self.request.user):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Only staff can assign surveys.')
        assignment = serializer.save(assigned_by=self.request.user)
        # Notify patient
        patient_user = assignment.patient.user
        notify(
            user=patient_user,
            code='SURVEY_ASSIGNED',
            channel='IN_APP',
            extra_data={'survey_id': str(assignment.survey_id), 'assignment_id': str(assignment.id)},
        )
        audit(
            request=self.request,
            action='CREATE',
            resource_type=ResourceType.OTHER,
            resource_id=str(assignment.id),
            note=f'survey={assignment.survey.title} patient={assignment.patient_id}',
        )


class AssignmentDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = SurveyAssignmentSerializer

    def get_queryset(self):
        user = self.request.user
        if _is_staff(user):
            return SurveyAssignment.objects.select_related('survey', 'patient__user')
        try:
            patient = PatientProfile.objects.get(user=user)
        except PatientProfile.DoesNotExist:
            return SurveyAssignment.objects.none()
        return SurveyAssignment.objects.filter(patient=patient).select_related('survey')


# ── Submit response ───────────────────────────────────────────────────────────

class SubmitResponseView(APIView):
    """
    POST /api/v1/surveys/assignments/<pk>/submit/
    Patient submits answers for an assignment. One-time only.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        user = request.user

        # Resolve assignment — patient sees own, staff sees any
        if _is_staff(user):
            assignment = get_object_or_404(SurveyAssignment, pk=pk)
        else:
            try:
                patient = PatientProfile.objects.get(user=user)
            except PatientProfile.DoesNotExist:
                return Response({'detail': 'No patient profile.'}, status=status.HTTP_403_FORBIDDEN)
            assignment = get_object_or_404(SurveyAssignment, pk=pk, patient=patient)

        if assignment.completed:
            return Response(
                {'detail': 'This assignment has already been completed.'},
                status=status.HTTP_409_CONFLICT,
            )

        serializer = SurveySubmitSerializer(
            data=request.data,
            context={'assignment': assignment, 'request': request},
        )
        serializer.is_valid(raise_exception=True)
        response_obj = serializer.save()

        audit(
            request=request,
            action='CREATE',
            resource_type=ResourceType.OTHER,
            resource_id=str(response_obj.id),
            note=f'assignment={pk}',
        )

        return Response(
            SurveyResponseReadSerializer(response_obj).data,
            status=status.HTTP_201_CREATED,
        )


# ── Responses (staff read) ────────────────────────────────────────────────────

class ResponseListView(generics.ListAPIView):
    """GET /api/v1/surveys/responses/ — staff only, all responses."""
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = SurveyResponseReadSerializer

    def get_queryset(self):
        if not _is_staff(self.request.user):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Only staff can list all responses.')
        qs = SurveyResponse.objects.select_related('assignment__survey', 'assignment__patient__user').prefetch_related('answers')
        survey_id = self.request.query_params.get('survey')
        patient_id = self.request.query_params.get('patient')
        if survey_id:
            qs = qs.filter(assignment__survey_id=survey_id)
        if patient_id:
            qs = qs.filter(assignment__patient_id=patient_id)
        return qs


class ResponseDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = SurveyResponseReadSerializer

    def get_queryset(self):
        user = self.request.user
        if _is_staff(user):
            return SurveyResponse.objects.prefetch_related('answers')
        try:
            patient = PatientProfile.objects.get(user=user)
        except PatientProfile.DoesNotExist:
            return SurveyResponse.objects.none()
        return SurveyResponse.objects.filter(
            assignment__patient=patient
        ).prefetch_related('answers')
