from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination

from core.permissions import IsPatient, IsDoctor, IsDoctorOfPatient
from .models import LabPanel, LabResult, LabRec
from .serializers import (
    LabPanelSerializer, LabPanelWriteSerializer,
    LabResultSerializer, LabResultWriteSerializer,
    LabSummaryItemSerializer, LabScanSerializer,
)


class LabPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


# ── Panels ────────────────────────────────────────────────────────────────────

class LabPanelListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsPatient]
    pagination_class = LabPagination

    def get_queryset(self):
        return LabPanel.objects.filter(patient=self.request.user.patient_profile)

    def get_serializer_class(self):
        return LabPanelWriteSerializer if self.request.method == 'POST' else LabPanelSerializer

    def perform_create(self, serializer):
        serializer.save(patient=self.request.user.patient_profile)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        panel = serializer.save(patient=request.user.patient_profile)
        return Response(LabPanelSerializer(panel).data, status=status.HTTP_201_CREATED)


class LabPanelDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsPatient]
    http_method_names = ['get', 'patch', 'delete']

    def get_queryset(self):
        return LabPanel.objects.filter(patient=self.request.user.patient_profile)

    def get_serializer_class(self):
        return LabPanelWriteSerializer if self.request.method == 'PATCH' else LabPanelSerializer


# ── Results (individual / panel) ──────────────────────────────────────────────

def _dispatch_recommendations(result: LabResult):
    from .tasks import generate_lab_recommendations
    generate_lab_recommendations.delay(str(result.pk))


class LabResultListCreateView(generics.ListCreateAPIView):
    """Quick-add individual result without requiring a panel."""
    permission_classes = [IsPatient]
    pagination_class = LabPagination

    def get_queryset(self):
        qs = LabResult.objects.filter(patient=self.request.user.patient_profile)
        param     = self.request.query_params.get('param')
        from_date = self.request.query_params.get('from')
        to_date   = self.request.query_params.get('to')
        if param:
            qs = qs.filter(parameter__icontains=param)
        if from_date:
            qs = qs.filter(performed_at__gte=from_date)
        if to_date:
            qs = qs.filter(performed_at__lte=to_date)
        return qs

    def get_serializer_class(self):
        return LabResultWriteSerializer if self.request.method == 'POST' else LabResultSerializer

    def create(self, request, *args, **kwargs):
        serializer = LabResultWriteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = serializer.save(patient=request.user.patient_profile)
        _dispatch_recommendations(result)
        return Response(LabResultSerializer(result).data, status=status.HTTP_201_CREATED)


class LabResultDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsPatient]
    serializer_class = LabResultWriteSerializer
    http_method_names = ['get', 'patch', 'delete']

    def get_queryset(self):
        return LabResult.objects.filter(patient=self.request.user.patient_profile)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        result = serializer.save()
        _dispatch_recommendations(result)
        return Response(LabResultSerializer(result).data)


class PanelResultCreateView(generics.CreateAPIView):
    """Add a result to an existing panel."""
    permission_classes = [IsPatient]
    serializer_class = LabResultWriteSerializer

    def create(self, request, *args, **kwargs):
        panel = get_object_or_404(
            LabPanel, pk=kwargs['panel_pk'], patient=request.user.patient_profile
        )
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = serializer.save(patient=request.user.patient_profile, panel=panel)
        _dispatch_recommendations(result)
        return Response(LabResultSerializer(result).data, status=status.HTTP_201_CREATED)


# ── Summary / Abnormal ────────────────────────────────────────────────────────

class LabSummaryView(APIView):
    permission_classes = [IsPatient]

    def get(self, request):
        patient = request.user.patient_profile
        # Latest result per unique parameter name
        from django.db.models import Max
        latest_dates = (
            LabResult.objects
            .filter(patient=patient)
            .values('parameter')
            .annotate(latest=Max('performed_at'))
        )
        data = []
        for item in latest_dates:
            result = (
                LabResult.objects
                .filter(patient=patient, parameter=item['parameter'], performed_at=item['latest'])
                .order_by('-created_at')
                .first()
            )
            if result:
                data.append({
                    'parameter':    result.parameter,
                    'value':        result.value,
                    'unit':         result.unit,
                    'status':       result.status,
                    'performed_at': result.performed_at,
                })
        return Response(LabSummaryItemSerializer(data, many=True).data)


class LabAbnormalView(generics.ListAPIView):
    permission_classes = [IsPatient]
    serializer_class = LabResultSerializer
    pagination_class = LabPagination

    def get_queryset(self):
        return LabResult.objects.filter(
            patient=self.request.user.patient_profile,
            status__in=[
                LabResult.Status.ABNORMAL_LOW,
                LabResult.Status.ABNORMAL_HIGH,
                LabResult.Status.CRITICAL,
            ],
        )


# ── OCR Placeholder ───────────────────────────────────────────────────────────

class LabScanView(APIView):
    permission_classes = [IsPatient]

    def post(self, request):
        serializer = LabScanSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        # TODO: integrate with vision pipeline (M10 Integrations)
        return Response(
            {
                'detail': 'Función de escáner disponible próximamente.',
                'detected_values': [],
            },
            status=status.HTTP_202_ACCEPTED,
        )


# ── Doctor views ──────────────────────────────────────────────────────────────

class DoctorPatientLabsView(generics.ListAPIView):
    permission_classes = [IsDoctor, IsDoctorOfPatient]
    serializer_class = LabPanelSerializer
    pagination_class = LabPagination

    def get_queryset(self):
        from apps.accounts.models import PatientProfile
        patient = get_object_or_404(PatientProfile, pk=self.kwargs['patient_id'])
        self.check_object_permissions(self.request, patient)
        return LabPanel.objects.filter(patient=patient)


class DoctorPatientLabSummaryView(APIView):
    permission_classes = [IsDoctor, IsDoctorOfPatient]

    def get(self, request, patient_id):
        from apps.accounts.models import PatientProfile
        from django.db.models import Max
        patient = get_object_or_404(PatientProfile, pk=patient_id)
        self.check_object_permissions(request, patient)

        latest_dates = (
            LabResult.objects
            .filter(patient=patient)
            .values('parameter')
            .annotate(latest=Max('performed_at'))
        )
        data = []
        for item in latest_dates:
            result = (
                LabResult.objects
                .filter(patient=patient, parameter=item['parameter'], performed_at=item['latest'])
                .order_by('-created_at')
                .first()
            )
            if result:
                data.append({
                    'parameter':    result.parameter,
                    'value':        result.value,
                    'unit':         result.unit,
                    'status':       result.status,
                    'performed_at': result.performed_at,
                })
        return Response(LabSummaryItemSerializer(data, many=True).data)
