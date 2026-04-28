from django.urls import path

from .views import (
    DailySummaryDetailView,
    DailySummaryListView,
    FoodEntryDetailView,
    FoodEntryListCreateView,
    MealSlotDetailView,
    MealSlotListCreateView,
    NutritionAssignmentDetailView,
    NutritionAssignmentListCreateView,
    NutritionPlanDetailView,
    NutritionPlanListCreateView,
    TriggerDailySummaryView,
)

urlpatterns = [
    # Plans
    path('plans/', NutritionPlanListCreateView.as_view(), name='nutrition-plan-list'),
    path('plans/<uuid:pk>/', NutritionPlanDetailView.as_view(), name='nutrition-plan-detail'),

    # Meal slots (nested under plan)
    path('plans/<uuid:plan_pk>/slots/', MealSlotListCreateView.as_view(), name='meal-slot-list'),
    path('plans/<uuid:plan_pk>/slots/<uuid:pk>/', MealSlotDetailView.as_view(), name='meal-slot-detail'),

    # Assignments
    path('assignments/', NutritionAssignmentListCreateView.as_view(), name='nutrition-assignment-list'),
    path('assignments/<uuid:pk>/', NutritionAssignmentDetailView.as_view(), name='nutrition-assignment-detail'),

    # Food diary
    path('entries/', FoodEntryListCreateView.as_view(), name='food-entry-list'),
    path('entries/<uuid:pk>/', FoodEntryDetailView.as_view(), name='food-entry-detail'),

    # Daily summaries
    path('summaries/', DailySummaryListView.as_view(), name='daily-summary-list'),
    path('summaries/<uuid:pk>/', DailySummaryDetailView.as_view(), name='daily-summary-detail'),

    # Trigger compute
    path('compute-summary/', TriggerDailySummaryView.as_view(), name='compute-summary'),
]
