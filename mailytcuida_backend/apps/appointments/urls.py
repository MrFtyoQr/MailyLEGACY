from django.urls import path
from .views import (
    PatientAppointmentListCreateView, PatientAppointmentDetailView, PatientCancelView,
    DoctorAppointmentListView, DoctorConfirmView, DoctorCompleteView,
    DoctorRescheduleView, AppointmentNoteView,
)

urlpatterns = [
    # Patient
    path('', PatientAppointmentListCreateView.as_view(), name='appointment-list'),
    path('<uuid:pk>/', PatientAppointmentDetailView.as_view(), name='appointment-detail'),
    path('<uuid:pk>/cancel/', PatientCancelView.as_view(), name='appointment-cancel'),

    # Doctor
    path('doctor/', DoctorAppointmentListView.as_view(), name='appointment-doctor-list'),
    path('<uuid:pk>/confirm/', DoctorConfirmView.as_view(), name='appointment-confirm'),
    path('<uuid:pk>/complete/', DoctorCompleteView.as_view(), name='appointment-complete'),
    path('<uuid:pk>/reschedule/', DoctorRescheduleView.as_view(), name='appointment-reschedule'),
    path('<uuid:pk>/notes/', AppointmentNoteView.as_view(), name='appointment-notes'),
]
