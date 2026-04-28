from django.urls import path
from .views import AdminAuditLogView, MyAuditLogView, PatientAuditLogView

urlpatterns = [
    path('',                                  AdminAuditLogView.as_view(),   name='audit-admin'),
    path('my/',                               MyAuditLogView.as_view(),      name='audit-my'),
    path('patient/<uuid:patient_id>/',        PatientAuditLogView.as_view(), name='audit-patient'),
]
