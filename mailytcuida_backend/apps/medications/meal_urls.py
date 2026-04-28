from django.urls import path
from .views import MealScheduleListCreateView, MealScheduleDetailView

urlpatterns = [
    path('', MealScheduleListCreateView.as_view(), name='meal-schedule-list'),
    path('<uuid:pk>/', MealScheduleDetailView.as_view(), name='meal-schedule-detail'),
]
