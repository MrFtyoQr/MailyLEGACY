import logging

from django.db.models import Min, Max, Avg, Count
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination

from core.permissions import IsPatient, IsDoctor, IsDoctorOfPatient
from .models import VitalSign, VitalGoal
from .serializers import (
    VitalSignSerializer, VitalGoalSerializer,
    VitalLatestSerializer, VitalSummarySerializer,
)

logger = logging.getLogger(__name__)


class VitalPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = 'page_size'
    max_page_size = 200


# ── Vital Signs ───────────────────────────────────────────────────────────────

class VitalSignListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsPatient]
    serializer_class = VitalSignSerializer
    pagination_class = VitalPagination

    def get_queryset(self):
        qs = VitalSign.objects.filter(patient=self.request.user.patient_profile)
        vital_type = self.request.query_params.get('type')
        from_date  = self.request.query_params.get('from')
        to_date    = self.request.query_params.get('to')
        if vital_type:
            qs = qs.filter(vital_type=vital_type)
        if from_date:
            qs = qs.filter(recorded_at__date__gte=from_date)
        if to_date:
            qs = qs.filter(recorded_at__date__lte=to_date)
        return qs

    def perform_create(self, serializer):
        photo_url = serializer.validated_data.get('photo_url', '')
        logger.info(
            'VitalSign create: patient=%s type=%s photo_url=%r',
            self.request.user.id,
            serializer.validated_data.get('vital_type'),
            photo_url,
        )
        instance = serializer.save(patient=self.request.user.patient_profile)
        # async check for abnormal reading
        from .tasks import check_abnormal_vitals
        check_abnormal_vitals.delay(str(instance.pk))


class VitalSignDetailView(generics.RetrieveDestroyAPIView):
    permission_classes = [IsPatient]
    serializer_class = VitalSignSerializer

    def get_queryset(self):
        return VitalSign.objects.filter(patient=self.request.user.patient_profile)


# ── Latest readings ───────────────────────────────────────────────────────────

class VitalLatestView(APIView):
    permission_classes = [IsPatient]

    def get(self, request):
        patient = request.user.patient_profile
        data = []
        for vital_type, _ in VitalSign.VitalType.choices:
            latest = (
                VitalSign.objects
                .filter(patient=patient, vital_type=vital_type)
                .order_by('-recorded_at')
                .first()
            )
            if latest:
                data.append({
                    'vital_type':       latest.vital_type,
                    'value':            latest.value,
                    'secondary_value':  latest.secondary_value,
                    'unit':             latest.unit,
                    'recorded_at':      latest.recorded_at,
                })
        return Response(VitalLatestSerializer(data, many=True).data)


# ── Summary statistics ────────────────────────────────────────────────────────

class VitalSummaryView(APIView):
    permission_classes = [IsPatient]

    def get(self, request):
        patient   = request.user.patient_profile
        from_date = request.query_params.get('from')
        to_date   = request.query_params.get('to')

        qs = VitalSign.objects.filter(patient=patient)
        if from_date:
            qs = qs.filter(recorded_at__date__gte=from_date)
        if to_date:
            qs = qs.filter(recorded_at__date__lte=to_date)

        data = []
        for vital_type, _ in VitalSign.VitalType.choices:
            type_qs = qs.filter(vital_type=vital_type)
            agg = type_qs.aggregate(
                count=Count('id'),
                min_v=Min('value'),
                max_v=Max('value'),
                avg_v=Avg('value'),
            )
            if agg['count'] == 0:
                continue
            last = type_qs.order_by('-recorded_at').values('value', 'unit', 'recorded_at').first()
            data.append({
                'vital_type':      vital_type,
                'unit':            last['unit'] if last else '',
                'count':           agg['count'],
                'min_value':       agg['min_v'],
                'max_value':       agg['max_v'],
                'avg_value':       agg['avg_v'],
                'last_value':      last['value'] if last else None,
                'last_recorded_at': last['recorded_at'] if last else None,
            })
        return Response(VitalSummarySerializer(data, many=True).data)


# ── Goals ─────────────────────────────────────────────────────────────────────

class VitalGoalListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsPatient]
    serializer_class = VitalGoalSerializer

    def get_queryset(self):
        return VitalGoal.objects.filter(
            patient=self.request.user.patient_profile, is_active=True
        )

    def perform_create(self, serializer):
        patient = self.request.user.patient_profile
        # Deactivate existing active goal for same type
        VitalGoal.objects.filter(
            patient=patient,
            vital_type=serializer.validated_data['vital_type'],
            is_active=True,
        ).update(is_active=False)
        serializer.save(patient=patient, set_by=self.request.user)


class VitalGoalDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsPatient]
    serializer_class = VitalGoalSerializer
    http_method_names = ['patch', 'delete']

    def get_queryset(self):
        return VitalGoal.objects.filter(
            patient=self.request.user.patient_profile, is_active=True
        )

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=['is_active'])


# ── Doctor views ──────────────────────────────────────────────────────────────

class DoctorPatientVitalsView(generics.ListAPIView):
    permission_classes = [IsDoctor, IsDoctorOfPatient]
    serializer_class = VitalSignSerializer
    pagination_class = VitalPagination

    def get_queryset(self):
        from apps.accounts.models import PatientProfile
        patient = get_object_or_404(PatientProfile, pk=self.kwargs['patient_id'])
        self.check_object_permissions(self.request, patient)

        qs = VitalSign.objects.filter(patient=patient)
        vital_type = self.request.query_params.get('type')
        from_date  = self.request.query_params.get('from')
        to_date    = self.request.query_params.get('to')
        if vital_type:
            qs = qs.filter(vital_type=vital_type)
        if from_date:
            qs = qs.filter(recorded_at__date__gte=from_date)
        if to_date:
            qs = qs.filter(recorded_at__date__lte=to_date)
        return qs


class DoctorPatientVitalsLatestView(APIView):
    permission_classes = [IsDoctor, IsDoctorOfPatient]

    def get(self, request, patient_id):
        from apps.accounts.models import PatientProfile
        patient = get_object_or_404(PatientProfile, pk=patient_id)
        self.check_object_permissions(request, patient)

        data = []
        for vital_type, _ in VitalSign.VitalType.choices:
            latest = (
                VitalSign.objects
                .filter(patient=patient, vital_type=vital_type)
                .order_by('-recorded_at')
                .first()
            )
            if latest:
                data.append({
                    'vital_type':      latest.vital_type,
                    'value':           latest.value,
                    'secondary_value': latest.secondary_value,
                    'unit':            latest.unit,
                    'recorded_at':     latest.recorded_at,
                })
        return Response(VitalLatestSerializer(data, many=True).data)
