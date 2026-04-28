from django.urls import path
from .views import (
    VitalSignListCreateView, VitalSignDetailView,
    VitalLatestView, VitalSummaryView,
    VitalGoalListCreateView, VitalGoalDetailView,
    DoctorPatientVitalsView, DoctorPatientVitalsLatestView,
)

urlpatterns = [
    # Readings
    path('', VitalSignListCreateView.as_view(), name='vital-list'),
    path('<uuid:pk>/', VitalSignDetailView.as_view(), name='vital-detail'),

    # Aggregated views
    path('latest/', VitalLatestView.as_view(), name='vital-latest'),
    path('summary/', VitalSummaryView.as_view(), name='vital-summary'),

    # Goals
    path('goals/', VitalGoalListCreateView.as_view(), name='vital-goal-list'),
    path('goals/<uuid:pk>/', VitalGoalDetailView.as_view(), name='vital-goal-detail'),

    # Doctor views
    path('patient/<uuid:patient_id>/', DoctorPatientVitalsView.as_view(), name='doctor-patient-vitals'),
    path('patient/<uuid:patient_id>/latest/', DoctorPatientVitalsLatestView.as_view(), name='doctor-patient-vitals-latest'),
]
