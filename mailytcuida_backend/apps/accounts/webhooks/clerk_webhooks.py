import json
import logging
from django.conf import settings
from django.http import JsonResponse
from django.views import View
from django.utils.decorators import method_decorator
from django.views.decorators.csrf import csrf_exempt
from svix.webhooks import Webhook, WebhookVerificationError
from apps.accounts.models import User, PatientProfile

logger = logging.getLogger(__name__)

ROLE_MAP = {
    'patient':    User.Role.PATIENT,
    'doctor':     User.Role.DOCTOR,
    'specialist': User.Role.SPECIALIST,
    'partner':    User.Role.PARTNER,
    'admin':      User.Role.ADMIN,
}


@method_decorator(csrf_exempt, name='dispatch')
class ClerkWebhookView(View):
    """
    Recibe y procesa eventos de Clerk via Svix.
    Mantiene la tabla accounts_user sincronizada.
    """

    def post(self, request, *args, **kwargs):
        payload = request.body
        headers = {
            'svix-id':        request.headers.get('svix-id', ''),
            'svix-timestamp': request.headers.get('svix-timestamp', ''),
            'svix-signature': request.headers.get('svix-signature', ''),
        }

        try:
            wh = Webhook(settings.CLERK_WEBHOOK_SECRET)
            event = wh.verify(payload, headers)
        except WebhookVerificationError:
            logger.warning('Webhook Clerk: firma inválida.')
            return JsonResponse({'error': 'Firma inválida'}, status=400)

        event_type = event.get('type')
        data = event.get('data', {})

        handlers = {
            'user.created': self._handle_created,
            'user.updated': self._handle_updated,
            'user.deleted': self._handle_deleted,
        }

        handler = handlers.get(event_type)
        if handler:
            handler(data)

        return JsonResponse({'status': 'ok'})

    def _handle_created(self, data: dict):
        clerk_id = data['id']
        email = self._extract_email(data)
        role_str = data.get('public_metadata', {}).get('role', 'patient')
        role = ROLE_MAP.get(role_str, User.Role.PATIENT)
        phone = data.get('phone_numbers', [{}])[0].get('phone_number', '')

        user, created = User.objects.get_or_create(
            clerk_id=clerk_id,
            defaults={'email': email, 'role': role, 'phone': phone},
        )

        if created and role == User.Role.PATIENT:
            first = data.get('first_name', '')
            last = data.get('last_name', '')
            PatientProfile.objects.create(
                user=user,
                first_name=first,
                last_name=last,
            )
            logger.info('Paciente creado desde Clerk: %s', email)

    def _handle_updated(self, data: dict):
        clerk_id = data['id']
        try:
            user = User.objects.get(clerk_id=clerk_id)
        except User.DoesNotExist:
            return

        email = self._extract_email(data)
        role_str = data.get('public_metadata', {}).get('role', '')
        if email:
            user.email = email
        if role_str and role_str in ROLE_MAP:
            user.role = ROLE_MAP[role_str]
        user.save(update_fields=['email', 'role', 'updated_at'])

    def _handle_deleted(self, data: dict):
        clerk_id = data['id']
        User.objects.filter(clerk_id=clerk_id).update(is_active=False)
        logger.info('Usuario desactivado: %s', clerk_id)

    @staticmethod
    def _extract_email(data: dict) -> str:
        emails = data.get('email_addresses', [])
        primary_id = data.get('primary_email_address_id')
        for e in emails:
            if e.get('id') == primary_id:
                return e.get('email_address', '')
        return emails[0].get('email_address', '') if emails else ''
