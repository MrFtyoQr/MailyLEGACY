import logging
from django.conf import settings
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny

from core.throttles import WebhookThrottle, CheckoutThrottle
from .models import Plan, Subscription, PaymentEvent
from .serializers import PlanSerializer, SubscriptionSerializer, CheckoutSerializer, PortalSerializer

logger = logging.getLogger(__name__)

_STRIPE_UNAVAILABLE = Response(
    {'detail': 'El módulo de pagos no está habilitado en este ambiente.'},
    status=status.HTTP_503_SERVICE_UNAVAILABLE,
)


def _stripe_active() -> bool:
    key = getattr(settings, 'STRIPE_SECRET_KEY', '')
    return bool(key)


# ── Plans ─────────────────────────────────────────────────────────────────────

class PlanListView(generics.ListAPIView):
    permission_classes = [AllowAny]
    serializer_class = PlanSerializer
    queryset = Plan.objects.filter(is_active=True)
    pagination_class = None


# ── Subscription ──────────────────────────────────────────────────────────────

class SubscriptionView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        try:
            sub = request.user.subscription
        except Subscription.DoesNotExist:
            # Auto-create FREE subscription on first access
            free_plan, _ = Plan.objects.get_or_create(
                tier='FREE',
                defaults={'name': 'Gratuito', 'price_mxn': 0, 'max_doctors': 1},
            )
            sub = Subscription.objects.create(user=request.user, plan=free_plan)
        return Response(SubscriptionSerializer(sub).data)


# ── Stripe Checkout ───────────────────────────────────────────────────────────

class CheckoutView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [CheckoutThrottle]

    def post(self, request):
        if not _stripe_active():
            return _STRIPE_UNAVAILABLE
        serializer = CheckoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        plan = Plan.objects.filter(tier=d['tier'], is_active=True).first()
        if not plan or not plan.stripe_price_id:
            return Response(
                {'detail': f'Plan {d["tier"]} no disponible o sin precio Stripe configurado.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            import stripe
            stripe.api_key = settings.STRIPE_SECRET_KEY

            # Get or create Stripe customer
            customer_id = _get_or_create_stripe_customer(request.user)

            session = stripe.checkout.Session.create(
                customer=customer_id,
                payment_method_types=['card'],
                line_items=[{'price': plan.stripe_price_id, 'quantity': 1}],
                mode='subscription',
                success_url=d['success_url'],
                cancel_url=d['cancel_url'],
                metadata={'user_id': str(request.user.pk), 'tier': d['tier']},
            )
            return Response({'checkout_url': session.url})

        except Exception as exc:
            logger.error('Stripe checkout error: %s', exc)
            return Response({'detail': 'Error al crear sesión de pago.'},
                            status=status.HTTP_502_BAD_GATEWAY)


# ── Customer Portal ───────────────────────────────────────────────────────────

class PortalView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_classes = [CheckoutThrottle]

    def post(self, request):
        if not _stripe_active():
            return _STRIPE_UNAVAILABLE
        serializer = PortalSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        try:
            sub = request.user.subscription
            if not sub.stripe_customer_id:
                return Response(
                    {'detail': 'No tienes una suscripción de pago activa.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        except Subscription.DoesNotExist:
            return Response(
                {'detail': 'No tienes suscripción.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            import stripe
            stripe.api_key = settings.STRIPE_SECRET_KEY
            session = stripe.billing_portal.Session.create(
                customer=sub.stripe_customer_id,
                return_url=serializer.validated_data['return_url'],
            )
            return Response({'portal_url': session.url})
        except Exception as exc:
            logger.error('Stripe portal error: %s', exc)
            return Response({'detail': 'Error al abrir portal de facturación.'},
                            status=status.HTTP_502_BAD_GATEWAY)


# ── Cancel ────────────────────────────────────────────────────────────────────

class CancelView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        if not _stripe_active():
            return _STRIPE_UNAVAILABLE
        try:
            sub = request.user.subscription
        except Subscription.DoesNotExist:
            return Response({'detail': 'No tienes suscripción.'}, status=status.HTTP_400_BAD_REQUEST)

        if sub.plan.tier == 'FREE':
            return Response({'detail': 'El plan gratuito no se puede cancelar.'}, status=status.HTTP_400_BAD_REQUEST)

        try:
            import stripe
            stripe.api_key = settings.STRIPE_SECRET_KEY
            stripe.Subscription.modify(
                sub.stripe_subscription_id, cancel_at_period_end=True
            )
            sub.cancel_at_period_end = True
            sub.save(update_fields=['cancel_at_period_end', 'updated_at'])
            return Response(SubscriptionSerializer(sub).data)
        except Exception as exc:
            logger.error('Stripe cancel error: %s', exc)
            return Response({'detail': 'Error al cancelar suscripción.'},
                            status=status.HTTP_502_BAD_GATEWAY)


# ── Webhook ───────────────────────────────────────────────────────────────────

class StripeWebhookView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []  # No Clerk auth — Stripe signs these
    throttle_classes = [WebhookThrottle]

    def post(self, request):
        payload    = request.body
        sig_header = request.META.get('HTTP_STRIPE_SIGNATURE', '')

        try:
            import stripe
            stripe.api_key = settings.STRIPE_SECRET_KEY
            event = stripe.Webhook.construct_event(
                payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
            )
        except Exception as exc:
            logger.warning('Stripe webhook validation failed: %s', exc)
            return Response({'detail': 'Invalid signature.'}, status=status.HTTP_400_BAD_REQUEST)

        # Idempotency: ignore already-processed events
        if PaymentEvent.objects.filter(stripe_event_id=event['id']).exists():
            return Response({'detail': 'already processed'})

        event_obj = PaymentEvent.objects.create(
            stripe_event_id=event['id'],
            event_type=event['type'],
            payload=dict(event),
        )

        from .tasks import process_stripe_event
        process_stripe_event.delay(str(event_obj.pk))

        return Response({'detail': 'ok'})


# ── helpers ───────────────────────────────────────────────────────────────────

def _get_or_create_stripe_customer(user) -> str:
    import stripe
    try:
        sub = user.subscription
        if sub.stripe_customer_id:
            return sub.stripe_customer_id
    except Subscription.DoesNotExist:
        pass

    customer = stripe.Customer.create(
        email=user.email,
        metadata={'user_id': str(user.pk)},
    )
    # Save customer ID
    Subscription.objects.update_or_create(
        user=user,
        defaults={'stripe_customer_id': customer['id']},
    )
    return customer['id']
