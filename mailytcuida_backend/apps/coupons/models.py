"""
Coupons & discount codes.

A Coupon is created by ADMIN and redeemed by a patient before
or during a Stripe Checkout session.

Discount types:
  PERCENT  — e.g. 20% off the first month
  FIXED    — e.g. $50 MXN off

Restrictions:
  - max_uses: total redemptions across all users (null = unlimited)
  - max_uses_per_user: per-user cap (null = unlimited)
  - valid_from / valid_until: date window
  - allowed_plans: JSON list of plan tiers the coupon applies to
                   (empty = all plans)
  - first_time_only: only for users who have never had a paid subscription

The coupon stores the Stripe coupon/promotion_code ID so it can be
passed directly to Stripe Checkout without re-creating it.
"""
import uuid
from django.db import models


class DiscountType(models.TextChoices):
    PERCENT = 'PERCENT', 'Porcentaje (%)'
    FIXED   = 'FIXED',   'Monto fijo (MXN)'


class Coupon(models.Model):
    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code            = models.CharField(max_length=32, unique=True,
                                       help_text='Uppercase alphanumeric, e.g. BIENVENIDO20')
    description     = models.CharField(max_length=255, blank=True)
    discount_type   = models.CharField(max_length=8, choices=DiscountType.choices)
    discount_value  = models.DecimalField(max_digits=8, decimal_places=2,
                                          help_text='% or MXN amount')

    # Validity window
    valid_from      = models.DateTimeField(null=True, blank=True)
    valid_until     = models.DateTimeField(null=True, blank=True)

    # Usage limits
    max_uses        = models.PositiveIntegerField(null=True, blank=True,
                                                   help_text='Null = unlimited')
    max_uses_per_user = models.PositiveSmallIntegerField(default=1)
    uses_count      = models.PositiveIntegerField(default=0, editable=False)

    # Restrictions
    allowed_plans   = models.JSONField(default=list, blank=True,
                                       help_text='["SILVER","GOLD"] — empty = all plans')
    first_time_only = models.BooleanField(default=False,
                                          help_text='Only for users with no prior paid subscription')

    # Stripe integration
    stripe_coupon_id     = models.CharField(max_length=128, blank=True,
                                             help_text='Stripe coupon ID')
    stripe_promotion_id  = models.CharField(max_length=128, blank=True,
                                             help_text='Stripe promotion code ID (for Checkout)')

    is_active       = models.BooleanField(default=True)
    created_by      = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='created_coupons',
    )
    created_at      = models.DateTimeField(auto_now_add=True)
    updated_at      = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        val = (f'{self.discount_value}%' if self.discount_type == DiscountType.PERCENT
               else f'${self.discount_value} MXN')
        return f'{self.code} — {val}'

    @property
    def is_exhausted(self):
        return self.max_uses is not None and self.uses_count >= self.max_uses


class CouponRedemption(models.Model):
    """
    Immutable record of a coupon being used by a patient.
    """
    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    coupon          = models.ForeignKey(
        Coupon, on_delete=models.PROTECT, related_name='redemptions'
    )
    user            = models.ForeignKey(
        'accounts.User', on_delete=models.CASCADE, related_name='coupon_redemptions'
    )
    # Snapshot of the discount applied
    discount_type   = models.CharField(max_length=8)
    discount_value  = models.DecimalField(max_digits=8, decimal_places=2)
    # The Stripe session/subscription this was applied to
    stripe_session_id      = models.CharField(max_length=128, blank=True)
    stripe_subscription_id = models.CharField(max_length=128, blank=True)
    redeemed_at     = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-redeemed_at']

    def __str__(self):
        return f'{self.user.email} used {self.coupon.code} at {self.redeemed_at:%Y-%m-%d}'
