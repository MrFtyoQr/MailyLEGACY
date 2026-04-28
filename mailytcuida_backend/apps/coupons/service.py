"""
Coupon validation and redemption logic.

Public API:
  validate_coupon(code, user, plan_tier) -> Coupon
    Raises CouponError with a user-facing message on any validation failure.

  redeem_coupon(coupon, user, stripe_session_id, stripe_subscription_id)
    Records the redemption and increments uses_count atomically.
"""
from django.db import transaction
from django.utils import timezone


class CouponError(Exception):
    """Raised when a coupon cannot be applied. Message is user-facing."""
    pass


def validate_coupon(code: str, user, plan_tier: str) -> 'Coupon':
    from .models import Coupon

    try:
        coupon = Coupon.objects.get(code=code.upper().strip(), is_active=True)
    except Coupon.DoesNotExist:
        raise CouponError('El código de descuento no existe o ha expirado.')

    now = timezone.now()

    if coupon.valid_from and now < coupon.valid_from:
        raise CouponError('Este cupón aún no está vigente.')

    if coupon.valid_until and now > coupon.valid_until:
        raise CouponError('Este cupón ha expirado.')

    if coupon.is_exhausted:
        raise CouponError('Este cupón ha alcanzado su límite de usos.')

    if coupon.allowed_plans and plan_tier not in coupon.allowed_plans:
        plans = ', '.join(coupon.allowed_plans)
        raise CouponError(f'Este cupón solo aplica para los planes: {plans}.')

    # Per-user cap
    user_uses = coupon.redemptions.filter(user=user).count()
    if user_uses >= coupon.max_uses_per_user:
        raise CouponError('Ya utilizaste este cupón el máximo de veces permitido.')

    if coupon.first_time_only:
        from apps.payments.models import Subscription
        has_paid = Subscription.objects.filter(
            user=user,
            plan__tier__in=['SILVER', 'GOLD', 'PLATINUM'],
        ).exists()
        if has_paid:
            raise CouponError('Este cupón es exclusivo para nuevos suscriptores.')

    return coupon


@transaction.atomic
def redeem_coupon(coupon, user,
                  stripe_session_id: str = '',
                  stripe_subscription_id: str = '') -> 'CouponRedemption':
    from .models import CouponRedemption

    redemption = CouponRedemption.objects.create(
        coupon                 = coupon,
        user                   = user,
        discount_type          = coupon.discount_type,
        discount_value         = coupon.discount_value,
        stripe_session_id      = stripe_session_id,
        stripe_subscription_id = stripe_subscription_id,
    )

    # Increment counter atomically
    from django.db.models import F
    coupon.__class__.objects.filter(pk=coupon.pk).update(uses_count=F('uses_count') + 1)

    return redemption
