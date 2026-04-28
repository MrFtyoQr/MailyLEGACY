from django.urls import path

from .views import (
    CompleteActivityView,
    DailyCheckinDetailView,
    DailyCheckinListView,
    EnrollmentDetailView,
    EnrollmentListCreateView,
    MoodEntryDetailView,
    MoodEntryListCreateView,
    SleepEntryDetailView,
    SleepEntryListCreateView,
    WellnessActivityDetailView,
    WellnessActivityListCreateView,
    WellnessProgramDetailView,
    WellnessProgramListCreateView,
)

urlpatterns = [
    # Programs
    path('programs/', WellnessProgramListCreateView.as_view(), name='wellness-program-list'),
    path('programs/<uuid:pk>/', WellnessProgramDetailView.as_view(), name='wellness-program-detail'),

    # Activities (nested)
    path('programs/<uuid:program_pk>/activities/', WellnessActivityListCreateView.as_view(), name='wellness-activity-list'),
    path('programs/<uuid:program_pk>/activities/<uuid:pk>/', WellnessActivityDetailView.as_view(), name='wellness-activity-detail'),

    # Enrollments
    path('enrollments/', EnrollmentListCreateView.as_view(), name='wellness-enrollment-list'),
    path('enrollments/<uuid:pk>/', EnrollmentDetailView.as_view(), name='wellness-enrollment-detail'),
    path('enrollments/<uuid:pk>/complete-activity/', CompleteActivityView.as_view(), name='wellness-complete-activity'),

    # Mood
    path('mood/', MoodEntryListCreateView.as_view(), name='mood-entry-list'),
    path('mood/<uuid:pk>/', MoodEntryDetailView.as_view(), name='mood-entry-detail'),

    # Sleep
    path('sleep/', SleepEntryListCreateView.as_view(), name='sleep-entry-list'),
    path('sleep/<uuid:pk>/', SleepEntryDetailView.as_view(), name='sleep-entry-detail'),

    # Daily check-in
    path('checkins/', DailyCheckinListView.as_view(), name='daily-checkin-list'),
    path('checkins/<uuid:pk>/', DailyCheckinDetailView.as_view(), name='daily-checkin-detail'),
]
