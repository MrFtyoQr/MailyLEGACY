from django.urls import path
from .views import (
    CouponListCreateView, CouponDetailView, CouponRedemptionListView,
    CouponValidateView, MyRedemptionsView,
)

urlpatterns = [
    # Admin
    path('',                         CouponListCreateView.as_view(),    name='coupons-list'),
    path('<uuid:pk>/',               CouponDetailView.as_view(),        name='coupons-detail'),
    path('<uuid:pk>/redemptions/',   CouponRedemptionListView.as_view(), name='coupons-redemptions'),
    # Patient
    path('validate/',                CouponValidateView.as_view(),      name='coupons-validate'),
    path('my-redemptions/',          MyRedemptionsView.as_view(),       name='coupons-my'),
]
