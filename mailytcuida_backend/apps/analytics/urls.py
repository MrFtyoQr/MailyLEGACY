from django.urls import path
from .views import (
    PatientDashboardView,
    AdherenceView, AdherenceReportListView,
    InsightListView, InsightGenerateView,
    DoctorPatientDashboardView,
)
from .ai_analyze import AIAnalyzeView

urlpatterns = [
    path('dashboard/',           PatientDashboardView.as_view(),   name='analytics-dashboard'),
    path('adherence/',           AdherenceView.as_view(),          name='analytics-adherence'),
    path('adherence/reports/',   AdherenceReportListView.as_view(), name='analytics-adherence-reports'),
    path('insights/',            InsightListView.as_view(),         name='analytics-insights'),
    path('insights/generate/',   InsightGenerateView.as_view(),     name='analytics-insights-generate'),
    path('patient/<uuid:patient_id>/dashboard/',
         DoctorPatientDashboardView.as_view(), name='analytics-doctor-dashboard'),
    path('analyze/',              AIAnalyzeView.as_view(),           name='ai-analyze'),
]
