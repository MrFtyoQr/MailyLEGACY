from django.urls import path
from .views import (
    PrescriptionListCreateView,
    PrescriptionDetailView,
    PrescriptionVerifyView,
    MailySoftReceiveView,
    MailySoftRevokeView,
)

urlpatterns = [
    # ── Patient ────────────────────────────────────────────────────────────
    path('',                          PrescriptionListCreateView.as_view(), name='prescriptions-list'),
    path('<uuid:pk>/',                PrescriptionDetailView.as_view(),     name='prescriptions-detail'),

    # ── Public QR verification (no auth) ──────────────────────────────────
    path('verify/<str:token>/',       PrescriptionVerifyView.as_view(),     name='prescriptions-verify'),

    # ── MailySoft webhooks (HMAC-signed, no Clerk auth) ────────────────────
    path('webhook/receive/',          MailySoftReceiveView.as_view(),       name='prescriptions-webhook-receive'),
    path('webhook/revoke/',           MailySoftRevokeView.as_view(),        name='prescriptions-webhook-revoke'),
]
