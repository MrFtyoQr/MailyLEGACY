from django.urls import path
from .views import (
    PlanListView, SubscriptionView,
    CheckoutView, PortalView, CancelView,
    StripeWebhookView,
)

urlpatterns = [
    path('plans/',        PlanListView.as_view(),        name='plan-list'),
    path('subscription/', SubscriptionView.as_view(),    name='subscription'),
    path('checkout/',     CheckoutView.as_view(),        name='checkout'),
    path('portal/',       PortalView.as_view(),          name='portal'),
    path('cancel/',       CancelView.as_view(),          name='cancel'),
    path('webhook/',      StripeWebhookView.as_view(),   name='stripe-webhook'),
]
