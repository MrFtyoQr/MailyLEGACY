from django.urls import path
from .views import (
    SpecialistListView, SpecialistDetailView,
    SpecialistRegisterView,
    TeamMemberListCreateView, TeamMemberRemoveView,
    ReferralListCreateView, ReferralDetailView,
    IncomingReferralListView, ReferralStatusUpdateView,
    PatientReferralListView, ReferralConsentView,
    SpecialistReviewListView, ReferralReviewCreateView,
)

urlpatterns = [
    # ── Browse specialists ─────────────────────────────────────────────────
    path('',                                    SpecialistListView.as_view(),          name='specialists-list'),
    path('<uuid:pk>/',                          SpecialistDetailView.as_view(),        name='specialists-detail'),
    path('<uuid:pk>/reviews/',                  SpecialistReviewListView.as_view(),    name='specialists-reviews'),

    # ── Doctor: register new specialist ───────────────────────────────────
    path('register/',                           SpecialistRegisterView.as_view(),      name='specialists-register'),

    # ── Doctor: team ──────────────────────────────────────────────────────
    path('team/',                               TeamMemberListCreateView.as_view(),    name='specialists-team'),
    path('team/<uuid:pk>/',                     TeamMemberRemoveView.as_view(),        name='specialists-team-remove'),

    # ── Referrals (doctor sends / detail) ─────────────────────────────────
    path('referrals/',                          ReferralListCreateView.as_view(),      name='referrals-list'),
    path('referrals/<uuid:pk>/',               ReferralDetailView.as_view(),           name='referrals-detail'),

    # ── Specialist: incoming referrals ────────────────────────────────────
    path('referrals/incoming/',                 IncomingReferralListView.as_view(),    name='referrals-incoming'),
    path('referrals/<uuid:pk>/status/',         ReferralStatusUpdateView.as_view(),    name='referrals-status'),

    # ── Patient: my referrals ─────────────────────────────────────────────
    path('referrals/mine/',                     PatientReferralListView.as_view(),     name='referrals-mine'),
    path('referrals/<uuid:pk>/consent/',        ReferralConsentView.as_view(),         name='referrals-consent'),

    # ── Reviews ───────────────────────────────────────────────────────────
    path('referrals/<uuid:pk>/review/',         ReferralReviewCreateView.as_view(),    name='referrals-review'),
]
