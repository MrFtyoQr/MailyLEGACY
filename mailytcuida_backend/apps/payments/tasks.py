from celery import shared_task
from django.utils import timezone
from datetime import timedelta
import logging

logger = logging.getLogger(__name__)

# Stripe subscription status → internal Status mapping
_STATUS_MAP = {
    'active':   'ACTIVE',
    'trialing': 'TRIALING',
    'past_due': 'PAST_DUE',
    'canceled': 'CANCELLED',
    'paused':   'PAUSED',
}


@shared_task(bind=True, max_retries=3, default_retry_delay=120)
def process_stripe_event(self, event_id: str):
    """Route and process a saved Stripe webhook event."""
    from .models import PaymentEvent

    try:
        event_obj = PaymentEvent.objects.select_related('user').get(pk=event_id)
    except PaymentEvent.DoesNotExist:
        return

    if event_obj.processed:
        return

    try:
        event_type = event_obj.event_type
        data       = event_obj.payload.get('data', {}).get('object', {})

        if event_type == 'checkout.session.completed':
            _handle_checkout_completed(data)
        elif event_type in ('customer.subscription.created', 'customer.subscription.updated'):
            _handle_subscription_upsert(data)
        elif event_type == 'customer.subscription.deleted':
            _handle_subscription_deleted(data)
        elif event_type == 'invoice.payment_succeeded':
            _handle_payment_succeeded(data)
        elif event_type == 'invoice.payment_failed':
            _handle_payment_failed(data)
        else:
            logger.debug('Unhandled Stripe event: %s', event_type)

        event_obj.processed = True
        event_obj.save(update_fields=['processed'])

    except Exception as exc:
        event_obj.error = str(exc)
        event_obj.save(update_fields=['error'])
        raise self.retry(exc=exc)


# ── Event handlers ────────────────────────────────────────────────────────────

def _handle_checkout_completed(data: dict):
    from apps.accounts.models import User
    from .models import Subscription, Plan

    user_id  = data.get('metadata', {}).get('user_id')
    tier     = data.get('metadata', {}).get('tier')
    cust_id  = data.get('customer')
    sub_id   = data.get('subscription')

    if not user_id:
        return

    try:
        user = User.objects.get(pk=user_id)
        plan = Plan.objects.get(tier=tier)
    except Exception:
        return

    sub, _ = Subscription.objects.update_or_create(
        user=user,
        defaults={
            'plan':                   plan,
            'stripe_customer_id':     cust_id or '',
            'stripe_subscription_id': sub_id or '',
            'status':                 Subscription.Status.ACTIVE,
        },
    )
    logger.info('Checkout completed: user=%s tier=%s', user_id, tier)


def _handle_subscription_upsert(data: dict):
    from apps.accounts.models import User
    from .models import Subscription, Plan

    cust_id = data.get('customer')
    sub_id  = data.get('id')
    raw_status = data.get('status', 'active')
    internal_status = _STATUS_MAP.get(raw_status, 'ACTIVE')

    stripe_price_id = None
    items = data.get('items', {}).get('data', [])
    if items:
        stripe_price_id = items[0].get('price', {}).get('id')

    sub = Subscription.objects.filter(stripe_subscription_id=sub_id).first()
    if not sub:
        sub = Subscription.objects.filter(stripe_customer_id=cust_id).first()
    if not sub:
        return

    updates = {'status': internal_status}

    if stripe_price_id:
        plan = Plan.objects.filter(stripe_price_id=stripe_price_id).first()
        if plan:
            updates['plan'] = plan

    import datetime
    if data.get('current_period_start'):
        updates['current_period_start'] = datetime.datetime.fromtimestamp(
            data['current_period_start'], tz=datetime.timezone.utc
        )
    if data.get('current_period_end'):
        updates['current_period_end'] = datetime.datetime.fromtimestamp(
            data['current_period_end'], tz=datetime.timezone.utc
        )

    updates['cancel_at_period_end'] = data.get('cancel_at_period_end', False)
    updates['stripe_subscription_id'] = sub_id

    if internal_status == 'PAST_DUE' and not sub.past_due_since:
        updates['past_due_since'] = timezone.now()
    elif internal_status != 'PAST_DUE':
        updates['past_due_since'] = None

    for k, v in updates.items():
        setattr(sub, k, v)
    sub.save()


def _handle_subscription_deleted(data: dict):
    from .models import Subscription, Plan

    sub_id = data.get('id')
    sub = Subscription.objects.filter(stripe_subscription_id=sub_id).first()
    if not sub:
        return

    free_plan, _ = Plan.objects.get_or_create(
        tier='FREE',
        defaults={'name': 'Gratuito', 'price_mxn': 0, 'max_doctors': 1},
    )
    sub.plan   = free_plan
    sub.status = Subscription.Status.CANCELLED
    sub.stripe_subscription_id = ''
    sub.save()
    logger.info('Subscription deleted → downgraded to FREE: user=%s', sub.user_id)


def _handle_payment_succeeded(data: dict):
    from .models import Subscription

    sub_id = data.get('subscription')
    if not sub_id:
        return
    Subscription.objects.filter(stripe_subscription_id=sub_id).update(
        status=Subscription.Status.ACTIVE,
        past_due_since=None,
    )


def _handle_payment_failed(data: dict):
    from .models import Subscription

    sub_id = data.get('subscription')
    if not sub_id:
        return

    sub = Subscription.objects.filter(stripe_subscription_id=sub_id).first()
    if not sub:
        return

    if not sub.past_due_since:
        sub.past_due_since = timezone.now()
    sub.status = Subscription.Status.PAST_DUE
    sub.save()

    notify_payment_failed.delay(str(sub.user_id))


# ── Periodic tasks ────────────────────────────────────────────────────────────

@shared_task
def notify_payment_failed(user_id: str):
    """Notify user that their payment failed."""
    from apps.accounts.models import User
    from apps.notifications.service import notify

    try:
        user = User.objects.get(pk=user_id)
    except User.DoesNotExist:
        return

    notify(user, 'WELCOME', context={
        'first_name': getattr(getattr(user, 'patient_profile', None), 'first_name', user.email)
    }, channel='EMAIL')
    # TODO: add PAYMENT_FAILED code to M07 templates
    logger.warning('Payment failed notified: user=%s', user_id)


@shared_task
def downgrade_expired_subscriptions():
    """
    Daily task. Downgrade PAST_DUE subscriptions to FREE after 7-day grace period.
    """
    from .models import Subscription, Plan

    cutoff = timezone.now() - timedelta(days=7)
    expired = Subscription.objects.filter(
        status=Subscription.Status.PAST_DUE,
        past_due_since__lt=cutoff,
    ).exclude(plan__tier='FREE')

    free_plan, _ = Plan.objects.get_or_create(
        tier='FREE',
        defaults={'name': 'Gratuito', 'price_mxn': 0, 'max_doctors': 1},
    )

    count = 0
    for sub in expired:
        sub.plan             = free_plan
        sub.status           = Subscription.Status.CANCELLED
        sub.past_due_since   = None
        sub.stripe_subscription_id = ''
        sub.save()
        count += 1
        logger.warning('Downgraded to FREE (past_due > 7d): user=%s', sub.user_id)

    return count
