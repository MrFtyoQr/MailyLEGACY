import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async

logger = logging.getLogger(__name__)


class ChatConsumer(AsyncWebsocketConsumer):
    """
    WebSocket consumer for real-time chat.

    Connection URL: ws://<host>/ws/chat/<conversation_id>/?token=<clerk_jwt>
    """

    async def connect(self):
        self.conversation_id = self.scope['url_route']['kwargs']['conversation_id']
        self.room_group = f'chat_{self.conversation_id}'

        # Authenticate via JWT query param
        user = await self._authenticate()
        if user is None:
            await self.close(code=4001)
            return

        # Verify user belongs to this conversation
        conv = await self._get_conversation(user)
        if conv is None:
            await self.close(code=4003)
            return

        self.user = user
        self.conversation = conv

        await self.channel_layer.group_add(self.room_group, self.channel_name)
        await self.accept()
        logger.info('WS connect: user=%s conv=%s', user.pk, self.conversation_id)

    async def disconnect(self, close_code):
        if hasattr(self, 'room_group'):
            await self.channel_layer.group_discard(self.room_group, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        try:
            data = json.loads(text_data or '{}')
        except json.JSONDecodeError:
            await self._send_error('Mensaje JSON inválido.')
            return

        event_type = data.get('type')

        if event_type == 'message':
            await self._handle_message(data)
        elif event_type == 'read':
            await self._handle_read()
        else:
            await self._send_error(f'Tipo de evento desconocido: {event_type}')

    # ── Event handlers ────────────────────────────────────────────────────────

    async def _handle_message(self, data: dict):
        text = data.get('text', '').strip()
        if not text:
            await self._send_error('El texto no puede estar vacío.')
            return

        msg = await self._save_message(text)
        payload = await self._serialize_message(msg)

        await self.channel_layer.group_send(
            self.room_group,
            {'type': 'chat_message', 'message': payload},
        )
        await self._push_if_offline(msg)

    async def _handle_read(self):
        count = await self._mark_read()
        await self.channel_layer.group_send(
            self.room_group,
            {'type': 'chat_read', 'reader_id': str(self.user.pk)},
        )

    # ── Channel layer event receivers ─────────────────────────────────────────

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            'type':    'message',
            'message': event['message'],
        }))

    async def chat_read(self, event):
        await self.send(text_data=json.dumps({
            'type':      'read',
            'reader_id': event['reader_id'],
        }))

    # ── DB helpers (sync_to_async) ────────────────────────────────────────────

    @database_sync_to_async
    def _authenticate(self):
        from apps.accounts.middleware.clerk_auth import _verify_clerk_token
        from apps.accounts.models import User

        query_string = self.scope.get('query_string', b'').decode()
        params = dict(p.split('=', 1) for p in query_string.split('&') if '=' in p)
        token = params.get('token', '')
        if not token:
            return None
        try:
            payload = _verify_clerk_token(token)
            return User.objects.get(clerk_id=payload['sub'])
        except Exception:
            return None

    @database_sync_to_async
    def _get_conversation(self, user):
        from .models import Conversation
        try:
            conv = Conversation.objects.select_related(
                'patient__user', 'doctor__user'
            ).get(pk=self.conversation_id)
        except Conversation.DoesNotExist:
            return None

        is_patient = hasattr(user, 'patient_profile') and conv.patient == user.patient_profile
        is_doctor  = hasattr(user, 'doctor_profile')  and conv.doctor  == user.doctor_profile
        return conv if (is_patient or is_doctor) else None

    @database_sync_to_async
    def _save_message(self, text: str):
        from .models import Message
        from django.utils import timezone
        msg = Message.objects.create(
            conversation=self.conversation,
            sender=self.user,
            text=text,
        )
        self.conversation.updated_at = timezone.now()
        self.conversation.save(update_fields=['updated_at'])
        return msg

    @database_sync_to_async
    def _serialize_message(self, msg) -> dict:
        return {
            'id':           str(msg.pk),
            'sender':       str(msg.sender_id),
            'sender_email': msg.sender.email,
            'text':         msg.text,
            'is_read':      msg.is_read,
            'created_at':   msg.created_at.isoformat(),
        }

    @database_sync_to_async
    def _mark_read(self) -> int:
        from django.utils import timezone
        return self.conversation.messages.filter(
            is_read=False
        ).exclude(sender=self.user).update(is_read=True, read_at=timezone.now())

    @database_sync_to_async
    def _push_if_offline(self, msg):
        from apps.notifications.service import notify
        conv = self.conversation
        sender = self.user

        if hasattr(sender, 'patient_profile') and sender.patient_profile == conv.patient:
            recipient_user = conv.doctor.user
        else:
            recipient_user = conv.patient.user

        doctor_name = f'{conv.doctor.first_name} {conv.doctor.last_name}'
        notify(
            user=recipient_user,
            code='DOCTOR_MESSAGE',
            context={'doctor_name': doctor_name},
            channel='PUSH',
            data={'screen': 'chat', 'conversation_id': str(conv.pk)},
        )

    async def _send_error(self, detail: str):
        await self.send(text_data=json.dumps({'type': 'error', 'detail': detail}))
