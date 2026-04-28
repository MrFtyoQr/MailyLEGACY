from django.urls import path
from .views import (
    MedicationListCreateView, MedicationDetailView,
    PatternListCreateView, PatternDetailView,
    ScheduleListCreateView, ScheduleDetailView,
    HistoryListView, HistoryTodayView,
    HistoryTakeView, HistorySkipView, HistoryPostponeView,
    DoctorPatientMedicationsView, DoctorPatientHistoryView,
)

urlpatterns = [
    # Medications
    path('', MedicationListCreateView.as_view(), name='medication-list'),
    path('<uuid:pk>/', MedicationDetailView.as_view(), name='medication-detail'),

    # Patterns
    path('<uuid:medication_pk>/patterns/', PatternListCreateView.as_view(), name='pattern-list'),
    path('<uuid:medication_pk>/patterns/<uuid:pk>/', PatternDetailView.as_view(), name='pattern-detail'),

    # Schedules
    path('<uuid:medication_pk>/schedules/', ScheduleListCreateView.as_view(), name='schedule-list'),
    path('<uuid:medication_pk>/schedules/<uuid:pk>/', ScheduleDetailView.as_view(), name='schedule-detail'),

    # History
    path('history/', HistoryListView.as_view(), name='history-list'),
    path('history/today/', HistoryTodayView.as_view(), name='history-today'),
    path('history/<uuid:pk>/take/', HistoryTakeView.as_view(), name='history-take'),
    path('history/<uuid:pk>/skip/', HistorySkipView.as_view(), name='history-skip'),
    path('history/<uuid:pk>/postpone/', HistoryPostponeView.as_view(), name='history-postpone'),

    # Doctor views
    path('patient/<uuid:patient_id>/', DoctorPatientMedicationsView.as_view(), name='doctor-patient-meds'),
    path('patient/<uuid:patient_id>/history/', DoctorPatientHistoryView.as_view(), name='doctor-patient-history'),
]
