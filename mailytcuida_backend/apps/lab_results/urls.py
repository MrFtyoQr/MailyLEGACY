from django.urls import path
from .views import (
    LabPanelListCreateView, LabPanelDetailView,
    LabResultListCreateView, LabResultDetailView,
    PanelResultCreateView,
    LabSummaryView, LabAbnormalView,
    LabScanView,
    DoctorPatientLabsView, DoctorPatientLabSummaryView,
)

urlpatterns = [
    # Panels
    path('', LabPanelListCreateView.as_view(), name='lab-panel-list'),
    path('<uuid:pk>/', LabPanelDetailView.as_view(), name='lab-panel-detail'),
    path('<uuid:panel_pk>/results/', PanelResultCreateView.as_view(), name='lab-panel-result-create'),

    # Individual results (no panel required)
    path('results/', LabResultListCreateView.as_view(), name='lab-result-list'),
    path('results/<uuid:pk>/', LabResultDetailView.as_view(), name='lab-result-detail'),

    # Aggregated views
    path('summary/', LabSummaryView.as_view(), name='lab-summary'),
    path('abnormal/', LabAbnormalView.as_view(), name='lab-abnormal'),

    # OCR placeholder
    path('scan/', LabScanView.as_view(), name='lab-scan'),

    # Doctor views
    path('patient/<uuid:patient_id>/', DoctorPatientLabsView.as_view(), name='doctor-patient-labs'),
    path('patient/<uuid:patient_id>/summary/', DoctorPatientLabSummaryView.as_view(), name='doctor-patient-lab-summary'),
]
