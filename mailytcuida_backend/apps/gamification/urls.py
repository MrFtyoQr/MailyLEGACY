from django.urls import path
from .views import (
    MyPlayerProfileView, MyTransactionsView,
    BadgeListView, LeaderboardView, DoctorPatientGameView,
)

urlpatterns = [
    path('me/',                          MyPlayerProfileView.as_view(),   name='gamification-me'),
    path('me/transactions/',             MyTransactionsView.as_view(),    name='gamification-transactions'),
    path('badges/',                      BadgeListView.as_view(),         name='gamification-badges'),
    path('leaderboard/',                 LeaderboardView.as_view(),       name='gamification-leaderboard'),
    path('patient/<uuid:patient_id>/',   DoctorPatientGameView.as_view(), name='gamification-patient'),
]
