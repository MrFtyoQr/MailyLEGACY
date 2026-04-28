from django.urls import path
from .views import (
    OrganizationListCreateView, OrganizationDetailView,
    EnrollPatientView, RemoveMemberView,
    PartnerDashboardView, PartnerMemberListView, PartnerSnapshotListView,
    MyEnrollmentsView, EnrollmentConsentView,
)

urlpatterns = [
    # ── ADMIN ──────────────────────────────────────────────────────────────
    path('organizations/',                              OrganizationListCreateView.as_view(), name='partners-orgs'),
    path('organizations/<uuid:pk>/',                   OrganizationDetailView.as_view(),     name='partners-org-detail'),
    path('organizations/<uuid:pk>/enroll/',            EnrollPatientView.as_view(),           name='partners-enroll'),
    path('organizations/<uuid:pk>/members/<uuid:mid>/', RemoveMemberView.as_view(),           name='partners-remove-member'),

    # ── PARTNER role ───────────────────────────────────────────────────────
    path('dashboard/',                                 PartnerDashboardView.as_view(),       name='partners-dashboard'),
    path('members/',                                   PartnerMemberListView.as_view(),       name='partners-members'),
    path('snapshots/',                                 PartnerSnapshotListView.as_view(),     name='partners-snapshots'),

    # ── PATIENT ────────────────────────────────────────────────────────────
    path('my-enrollments/',                            MyEnrollmentsView.as_view(),           name='partners-my-enrollments'),
    path('my-enrollments/<uuid:mid>/consent/',         EnrollmentConsentView.as_view(),       name='partners-consent'),
]
