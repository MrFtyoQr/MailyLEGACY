from django.contrib import admin
from .models import Plan, Subscription, PaymentEvent


@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    list_display  = ('tier', 'name', 'price_mxn', 'max_doctors', 'stripe_price_id', 'is_active')
    list_filter   = ('is_active',)
    readonly_fields = ('created_at', 'updated_at')


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display   = ('user', 'plan', 'status', 'cancel_at_period_end',
                      'current_period_end', 'past_due_since')
    list_filter    = ('status', 'plan')
    search_fields  = ('user__email', 'stripe_customer_id', 'stripe_subscription_id')
    readonly_fields = ('created_at', 'updated_at', 'stripe_customer_id', 'stripe_subscription_id')


@admin.register(PaymentEvent)
class PaymentEventAdmin(admin.ModelAdmin):
    list_display   = ('event_type', 'stripe_event_id', 'processed', 'user', 'created_at')
    list_filter    = ('event_type', 'processed')
    search_fields  = ('stripe_event_id', 'user__email')
    readonly_fields = ('stripe_event_id', 'event_type', 'payload', 'created_at')
