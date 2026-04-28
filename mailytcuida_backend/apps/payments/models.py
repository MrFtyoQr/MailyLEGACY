import uuid
from django.db import models


class Plan(models.Model):
    class Tier(models.TextChoices):
        FREE     = 'FREE',     'Gratuito'
        SILVER   = 'SILVER',   'Silver'
        GOLD     = 'GOLD',     'Gold'
        PLATINUM = 'PLATINUM', 'Platinum'

    # AI model assigned per tier
    AI_MODEL = {
        'FREE':     'gpt-4o-mini',
        'SILVER':   'gpt-4o',
        'GOLD':     'gpt-4o',
        'PLATINUM': 'claude-sonnet-4-6',
    }

    tier             = models.CharField(max_length=10, choices=Tier.choices, unique=True)
    name             = models.CharField(max_length=100)
    price_mxn        = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    stripe_price_id  = models.CharField(max_length=100, blank=True)  # price_xxx from Stripe
    max_doctors      = models.PositiveIntegerField(default=1)         # doctors per patient
    features         = models.JSONField(default=list)                 # feature flag list
    is_active        = models.BooleanField(default=True)
    created_at       = models.DateTimeField(auto_now_add=True)
    updated_at       = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'payments_plan'
        ordering = ['price_mxn']

    @property
    def ai_model(self) -> str:
        return self.AI_MODEL.get(self.tier, 'gpt-4o-mini')

    def __str__(self):
        return f'{self.name} (${self.price_mxn}/mes)'


class Subscription(models.Model):
    class Status(models.TextChoices):
        ACTIVE    = 'ACTIVE',    'Activa'
        TRIALING  = 'TRIALING',  'Prueba'
        PAST_DUE  = 'PAST_DUE',  'Pago vencido'
        CANCELLED = 'CANCELLED', 'Cancelada'
        PAUSED    = 'PAUSED',    'Pausada'

    id                      = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user                    = models.OneToOneField(
        'accounts.User', on_delete=models.CASCADE, related_name='subscription'
    )
    plan                    = models.ForeignKey(
        Plan, on_delete=models.PROTECT, related_name='subscriptions'
    )
    stripe_customer_id      = models.CharField(max_length=100, blank=True, db_index=True)
    stripe_subscription_id  = models.CharField(max_length=100, blank=True, db_index=True)
    status                  = models.CharField(
        max_length=15, choices=Status.choices, default=Status.ACTIVE
    )
    current_period_start    = models.DateTimeField(null=True, blank=True)
    current_period_end      = models.DateTimeField(null=True, blank=True)
    cancel_at_period_end    = models.BooleanField(default=False)
    past_due_since          = models.DateTimeField(null=True, blank=True)
    created_at              = models.DateTimeField(auto_now_add=True)
    updated_at              = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'payments_subscription'

    def __str__(self):
        return f'{self.user.email} — {self.plan.tier} ({self.status})'

    @property
    def is_access_allowed(self) -> bool:
        return self.status in (self.Status.ACTIVE, self.Status.TRIALING, self.Status.PAST_DUE)


class PaymentEvent(models.Model):
    """Immutable audit log of every Stripe webhook event received."""
    id               = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    stripe_event_id  = models.CharField(max_length=100, unique=True)
    event_type       = models.CharField(max_length=100, db_index=True)
    user             = models.ForeignKey(
        'accounts.User', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='payment_events'
    )
    payload          = models.JSONField()
    processed        = models.BooleanField(default=False)
    error            = models.TextField(blank=True)
    created_at       = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'payments_event'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.event_type} [{self.stripe_event_id}] processed={self.processed}'
