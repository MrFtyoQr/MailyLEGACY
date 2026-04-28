from django.urls import path
from .views import (
    DocumentListCreateView,
    DocumentDetailView,
    PresignedUploadUrlView,
    DocumentOCRView,
    DocumentShareListCreateView,
    DocumentShareRevokeView,
    SharedWithMeView,
    HealthSummaryExportRequestView,
    HealthSummaryExportListView,
)

urlpatterns = [
    # ── Patient documents ──────────────────────────────────────────────────
    path('',                               DocumentListCreateView.as_view(),     name='documents-list'),
    path('<uuid:pk>/',                     DocumentDetailView.as_view(),          name='documents-detail'),
    path('upload-url/',                    PresignedUploadUrlView.as_view(),      name='documents-upload-url'),
    path('<uuid:pk>/ocr/',                 DocumentOCRView.as_view(),             name='documents-ocr'),

    # ── Sharing ────────────────────────────────────────────────────────────
    path('<uuid:pk>/shares/',              DocumentShareListCreateView.as_view(), name='documents-shares'),
    path('<uuid:pk>/shares/<uuid:share_id>/', DocumentShareRevokeView.as_view(), name='documents-shares-revoke'),

    # ── Doctor: shared with me ─────────────────────────────────────────────
    path('shared-with-me/',               SharedWithMeView.as_view(),            name='documents-shared-with-me'),

    # ── PDF exports ────────────────────────────────────────────────────────
    path('export/',                        HealthSummaryExportRequestView.as_view(), name='documents-export'),
    path('exports/',                       HealthSummaryExportListView.as_view(),    name='documents-exports'),
]
