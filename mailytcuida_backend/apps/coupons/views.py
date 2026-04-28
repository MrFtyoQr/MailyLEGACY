"""
Coupons API.

ADMIN:
  GET/POST  /api/v1/coupons/               — manage coupons
  GET/PATCH /api/v1/coupons/<id>/          — detail / update
  GET       /api/v1/coupons/<id>/redemptions/ — who used this coupon

Patient:
  POST /api/v1/coupons/validate/           — check a code before checkout
  GET  /api/v1/coupons/my-redemptions/     — patient's own usage history
"""
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import Coupon, CouponRedemption
from .serializers import (
    CouponSerializer, CouponValidateSerializer,
    CouponValidateResponseSerializer, CouponRedemptionSerializer,
)
from .service import validate_coupon, CouponError


def _require_admin(request):
    if getattr(request.user, 'role', '') != 'ADMIN':
        from rest_framework.exceptions import PermissionDenied
        raise PermissionDenied('Solo administradores pueden gestionar cupones.')


# ── ADMIN ──────────────────────────────────────────────────────────────────────

class CouponListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class   = CouponSerializer

    def get_queryset(self):
        _require_admin(self.request)
        return Coupon.objects.all()

    def perform_create(self, serializer):
        _require_admin(self.request)
        serializer.save(created_by=self.request.user)


class CouponDetailView(generics.RetrieveUpdateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class   = CouponSerializer
    http_method_names  = ['get', 'patch']

    def get_object(self):
        _require_admin(self.request)
        return get_object_or_404(Coupon, pk=self.kwargs['pk'])


class CouponRedemptionListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class   = CouponRedemptionSerializer

    def get_queryset(self):
        _require_admin(self.request)
        coupon = get_object_or_404(Coupon, pk=self.kwargs['pk'])
        return CouponRedemption.objects.filter(coupon=coupon)


# ── Patient ────────────────────────────────────────────────────────────────────

class CouponValidateView(APIView):
    """
    Patient validates a coupon code before initiating Stripe Checkout.
    Returns the stripe_promotion_id to pass to the Checkout session.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ser = CouponValidateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        try:
            coupon = validate_coupon(
                code      = ser.validated_data['code'],
                user      = request.user,
                plan_tier = ser.validated_data['plan_tier'],
            )
            return Response({
                'valid':               True,
                'discount_type':       coupon.discount_type,
                'discount_value':      coupon.discount_value,
                'description':         coupon.description,
                'stripe_promotion_id': coupon.stripe_promotion_id,
                'error':               '',
            })
        except CouponError as exc:
            return Response({
                'valid':               False,
                'discount_type':       '',
                'discount_value':      0,
                'description':         '',
                'stripe_promotion_id': '',
                'error':               str(exc),
            })


class MyRedemptionsView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class   = CouponRedemptionSerializer

    def get_queryset(self):
        return CouponRedemption.objects.filter(user=self.request.user)
