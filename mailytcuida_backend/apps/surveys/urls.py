from django.urls import path

from .views import (
    AssignmentDetailView,
    AssignmentListCreateView,
    ResponseDetailView,
    ResponseListView,
    SubmitResponseView,
    SurveyDetailView,
    SurveyListCreateView,
    SurveyQuestionDetailView,
    SurveyQuestionListCreateView,
)

urlpatterns = [
    # Survey templates
    path('', SurveyListCreateView.as_view(), name='survey-list'),
    path('<uuid:pk>/', SurveyDetailView.as_view(), name='survey-detail'),

    # Questions (nested under survey)
    path('<uuid:survey_pk>/questions/', SurveyQuestionListCreateView.as_view(), name='question-list'),
    path('<uuid:survey_pk>/questions/<uuid:pk>/', SurveyQuestionDetailView.as_view(), name='question-detail'),

    # Assignments
    path('assignments/', AssignmentListCreateView.as_view(), name='assignment-list'),
    path('assignments/<uuid:pk>/', AssignmentDetailView.as_view(), name='assignment-detail'),
    path('assignments/<uuid:pk>/submit/', SubmitResponseView.as_view(), name='assignment-submit'),

    # Responses
    path('responses/', ResponseListView.as_view(), name='response-list'),
    path('responses/<uuid:pk>/', ResponseDetailView.as_view(), name='response-detail'),
]
