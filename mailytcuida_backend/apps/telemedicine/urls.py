from django.urls import path
from .views import (
    SessionListCreateView, SessionDetailView,
    SessionLinkUpdateView, SessionStatusUpdateView,
    SessionNoteView, PatientCheckinView,
    PatientSessionListView, PatientFeedbackView,
)

urlpatterns = [
    # Doctor
    path('sessions/',                         SessionListCreateView.as_view(),  name='tele-sessions'),
    path('sessions/<uuid:pk>/',               SessionDetailView.as_view(),      name='tele-session-detail'),
    path('sessions/<uuid:pk>/link/',          SessionLinkUpdateView.as_view(),  name='tele-session-link'),
    path('sessions/<uuid:pk>/status/',        SessionStatusUpdateView.as_view(), name='tele-session-status'),
    path('sessions/<uuid:pk>/note/',          SessionNoteView.as_view(),         name='tele-session-note'),
    path('sessions/<uuid:pk>/checkin/',       PatientCheckinView.as_view(),      name='tele-checkin'),
    # Patient
    path('sessions/mine/',                    PatientSessionListView.as_view(),  name='tele-mine'),
    path('sessions/<uuid:pk>/feedback/',      PatientFeedbackView.as_view(),     name='tele-feedback'),
]
