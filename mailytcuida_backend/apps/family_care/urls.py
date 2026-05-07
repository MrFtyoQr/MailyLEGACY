from django.urls import path
from .views import (
    FamilyCareLinkListCreateView, FamilyCareLinkAcceptView, FamilyCareLinkRevokeView,
    PatientVitalListView, PatientVitalFrequencyView,
    PatientMedicationView, PatientAppointmentView,
    VitalMonitorConfigListCreateView, VitalMonitorConfigDetailView,
    CareAlertListView, DispatchDoctorView, DismissAlertView,
    MedicationPaymentListCreateView,
)

urlpatterns = [
    path('links/',                                              FamilyCareLinkListCreateView.as_view(),   name='fc-link-list'),
    path('links/<uuid:pk>/accept/',                            FamilyCareLinkAcceptView.as_view(),        name='fc-link-accept'),
    path('links/<uuid:pk>/revoke/',                            FamilyCareLinkRevokeView.as_view(),        name='fc-link-revoke'),
    path('links/<uuid:pk>/vitals/',                            PatientVitalListView.as_view(),            name='fc-vitals'),
    path('links/<uuid:pk>/vitals/frequency/',                  PatientVitalFrequencyView.as_view(),       name='fc-vitals-frequency'),
    path('links/<uuid:pk>/medications/',                       PatientMedicationView.as_view(),           name='fc-medications'),
    path('links/<uuid:pk>/appointments/',                      PatientAppointmentView.as_view(),          name='fc-appointments'),
    path('links/<uuid:pk>/monitor-configs/',                   VitalMonitorConfigListCreateView.as_view(), name='fc-monitor-list'),
    path('links/<uuid:pk>/monitor-configs/<uuid:cfg_id>/',     VitalMonitorConfigDetailView.as_view(),    name='fc-monitor-detail'),
    path('links/<uuid:pk>/alerts/',                            CareAlertListView.as_view(),               name='fc-alerts'),
    path('links/<uuid:pk>/alerts/<uuid:alert_id>/dispatch-doctor/', DispatchDoctorView.as_view(),         name='fc-dispatch-doctor'),
    path('links/<uuid:pk>/alerts/<uuid:alert_id>/dismiss/',    DismissAlertView.as_view(),                name='fc-dismiss-alert'),
    path('links/<uuid:pk>/payments/',                          MedicationPaymentListCreateView.as_view(), name='fc-payments'),
]
