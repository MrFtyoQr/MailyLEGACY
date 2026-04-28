"""
Nutrition views.

ADMIN / DOCTOR → full CRUD on plans, can assign and read all data.
PATIENT        → read own assignments, log/edit/delete own food entries,
                 read own daily summaries.
"""
from django.shortcuts import get_object_or_404
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.models import PatientProfile
from apps.audit.logger import ResourceType, audit
from apps.notifications.service import notify

from .models import (
    DailyNutritionSummary,
    FoodEntry,
    MealSlot,
    NutritionPlan,
    NutritionPlanAssignment,
)
from .serializers import (
    DailyNutritionSummarySerializer,
    FoodEntrySerializer,
    MealSlotSerializer,
    NutritionPlanAssignmentCreateSerializer,
    NutritionPlanAssignmentSerializer,
    NutritionPlanSerializer,
    NutritionPlanWriteSerializer,
)


def _is_staff(user):
    return getattr(user, 'role', '') in ('ADMIN', 'DOCTOR')


def _get_patient(user):
    try:
        return PatientProfile.objects.get(user=user)
    except PatientProfile.DoesNotExist:
        return None


# ── Nutrition Plans ───────────────────────────────────────────────────────────

class NutritionPlanListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        qs = NutritionPlan.objects.prefetch_related('meal_slots')
        if not _is_staff(self.request.user):
            qs = qs.filter(is_active=True)
        return qs

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return NutritionPlanWriteSerializer
        return NutritionPlanSerializer

    def perform_create(self, serializer):
        if not _is_staff(self.request.user):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Solo el staff puede crear planes nutricionales.')
        plan = serializer.save(created_by=self.request.user)
        audit(
            request=self.request,
            action='CREATE',
            resource_type=ResourceType.OTHER,
            resource_id=str(plan.id),
            note=f'title={plan.title}',
        )


class NutritionPlanDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    queryset = NutritionPlan.objects.prefetch_related('meal_slots')

    def get_serializer_class(self):
        if self.request.method in ('PUT', 'PATCH'):
            return NutritionPlanWriteSerializer
        return NutritionPlanSerializer

    def perform_update(self, serializer):
        if not _is_staff(self.request.user):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Solo el staff puede editar planes.')
        serializer.save()

    def perform_destroy(self, instance):
        if not _is_staff(self.request.user):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Solo el staff puede eliminar planes.')
        instance.is_active = False
        instance.save(update_fields=['is_active'])


# ── Meal Slots ────────────────────────────────────────────────────────────────

class MealSlotListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = MealSlotSerializer

    def get_plan(self):
        return get_object_or_404(NutritionPlan, pk=self.kwargs['plan_pk'])

    def get_queryset(self):
        return MealSlot.objects.filter(plan_id=self.kwargs['plan_pk'])

    def perform_create(self, serializer):
        if not _is_staff(self.request.user):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Solo el staff puede agregar comidas al plan.')
        plan = self.get_plan()
        serializer.save(plan=plan)


class MealSlotDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = MealSlotSerializer

    def get_queryset(self):
        return MealSlot.objects.filter(plan_id=self.kwargs['plan_pk'])

    def perform_update(self, serializer):
        if not _is_staff(self.request.user):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied()
        serializer.save()

    def perform_destroy(self, instance):
        if not _is_staff(self.request.user):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied()
        instance.delete()


# ── Assignments ───────────────────────────────────────────────────────────────

class NutritionAssignmentListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        if _is_staff(user):
            return NutritionPlanAssignment.objects.select_related('plan', 'patient__user').all()
        patient = _get_patient(user)
        if not patient:
            return NutritionPlanAssignment.objects.none()
        return NutritionPlanAssignment.objects.filter(
            patient=patient, is_active=True
        ).select_related('plan')

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return NutritionPlanAssignmentCreateSerializer
        return NutritionPlanAssignmentSerializer

    def perform_create(self, serializer):
        if not _is_staff(self.request.user):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Solo el staff puede asignar planes.')
        assignment = serializer.save(assigned_by=self.request.user)
        notify(
            user=assignment.patient.user,
            code='NUTRITION_PLAN_ASSIGNED',
            channel='IN_APP',
            extra_data={
                'plan_id': str(assignment.plan_id),
                'plan_title': assignment.plan.title,
            },
        )
        audit(
            request=self.request,
            action='CREATE',
            resource_type=ResourceType.OTHER,
            resource_id=str(assignment.id),
            note=f'plan={assignment.plan.title} patient={assignment.patient_id}',
        )


class NutritionAssignmentDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = NutritionPlanAssignmentSerializer

    def get_queryset(self):
        user = self.request.user
        if _is_staff(user):
            return NutritionPlanAssignment.objects.select_related('plan')
        patient = _get_patient(user)
        if not patient:
            return NutritionPlanAssignment.objects.none()
        return NutritionPlanAssignment.objects.filter(patient=patient).select_related('plan')

    def perform_update(self, serializer):
        if not _is_staff(self.request.user):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied()
        serializer.save()


# ── Food Diary ────────────────────────────────────────────────────────────────

class FoodEntryListCreateView(generics.ListCreateAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = FoodEntrySerializer

    def get_queryset(self):
        user = self.request.user
        if _is_staff(user):
            patient_id = self.request.query_params.get('patient')
            qs = FoodEntry.objects.all()
            if patient_id:
                qs = qs.filter(patient_id=patient_id)
            return qs
        patient = _get_patient(user)
        if not patient:
            return FoodEntry.objects.none()
        qs = FoodEntry.objects.filter(patient=patient)
        date_param = self.request.query_params.get('date')
        if date_param:
            qs = qs.filter(logged_at__date=date_param)
        meal_type = self.request.query_params.get('meal_type')
        if meal_type:
            qs = qs.filter(meal_type=meal_type)
        return qs

    def perform_create(self, serializer):
        user = self.request.user
        if _is_staff(user):
            # Staff can log on behalf of a patient via query param
            patient_id = self.request.query_params.get('patient')
            patient = get_object_or_404(PatientProfile, pk=patient_id) if patient_id else None
        else:
            patient = _get_patient(user)
            if not patient:
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied('No hay perfil de paciente.')
        serializer.save(patient=patient)


class FoodEntryDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = FoodEntrySerializer

    def get_queryset(self):
        user = self.request.user
        if _is_staff(user):
            return FoodEntry.objects.all()
        patient = _get_patient(user)
        if not patient:
            return FoodEntry.objects.none()
        return FoodEntry.objects.filter(patient=patient)


# ── Daily Summary ─────────────────────────────────────────────────────────────

class DailySummaryListView(generics.ListAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = DailyNutritionSummarySerializer

    def get_queryset(self):
        user = self.request.user
        if _is_staff(user):
            patient_id = self.request.query_params.get('patient')
            qs = DailyNutritionSummary.objects.all()
            if patient_id:
                qs = qs.filter(patient_id=patient_id)
            return qs
        patient = _get_patient(user)
        if not patient:
            return DailyNutritionSummary.objects.none()
        return DailyNutritionSummary.objects.filter(patient=patient)


class DailySummaryDetailView(generics.RetrieveAPIView):
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = DailyNutritionSummarySerializer

    def get_queryset(self):
        user = self.request.user
        if _is_staff(user):
            return DailyNutritionSummary.objects.all()
        patient = _get_patient(user)
        if not patient:
            return DailyNutritionSummary.objects.none()
        return DailyNutritionSummary.objects.filter(patient=patient)


# ── Trigger summary compute (staff / debug) ───────────────────────────────────

class TriggerDailySummaryView(APIView):
    """POST /api/v1/nutrition/compute-summary/ — staff only, triggers Celery task."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        if not _is_staff(request.user):
            return Response({'detail': 'Solo el staff puede lanzar este proceso.'}, status=status.HTTP_403_FORBIDDEN)
        from .tasks import compute_daily_nutrition_summary
        target_date = request.data.get('date')  # optional YYYY-MM-DD
        compute_daily_nutrition_summary.delay(target_date)
        return Response({'detail': 'Tarea encolada.', 'date': target_date or 'yesterday'})
