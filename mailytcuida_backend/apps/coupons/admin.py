from django.contrib import admin
from .models import Coupon, CouponRedemption


class CouponRedemptionInline(admin.TabularInline):
    model          = CouponRedemption
    extra          = 0
    readonly_fields = ('user', 'discount_type', 'discount_value',
                       'stripe_session_id', 'redeemed_at')
    can_delete     = False


@admin.register(Coupon)
class CouponAdmin(admin.ModelAdmin):
    list_display   = ('code', 'discount_type', 'discount_value', 'uses_count',
                      'max_uses', 'valid_until', 'is_active', 'is_exhausted')
    list_filter    = ('discount_type', 'is_active', 'first_time_only')
    search_fields  = ('code', 'description')
    readonly_fields = ('id', 'uses_count', 'created_at', 'updated_at')
    raw_id_fields  = ('created_by',)
    inlines        = [CouponRedemptionInline]


@admin.register(CouponRedemption)
class CouponRedemptionAdmin(admin.ModelAdmin):
    list_display  = ('user', 'coupon', 'discount_value', 'redeemed_at')
    list_filter   = ('coupon',)
    readonly_fields = ('id', 'coupon', 'user', 'discount_type', 'discount_value',
                       'stripe_session_id', 'stripe_subscription_id', 'redeemed_at')

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False
