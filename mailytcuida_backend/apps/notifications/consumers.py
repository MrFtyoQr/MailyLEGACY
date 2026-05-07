import json
import logging
from channels.generic.websocket import AsyncWebsocketConsumer
from django.conf import settings

logger = logging.getLogger(__name__)


def _group_name(user_id) -> str:
    return f'notif_{user_id}'


class NotificationConsumer(AsyncWebsocketConsumer):
    """
    ws://<host>/ws/notifications/?token=<clerk_jwt>
    ws://<host>/ws/notifications/?email=<email>   (DEV_AUTH_BYPASS only)

    On connect: auth → join group → send unread PENDING notifications → accept.
    On disconnect: leave group.
    Receives 'notification_push' events from the channel layer and forwards as JSON.
    """

    async def connect(self):
        user = await self._authenticate()
        if user is None:
            await self.close(code=4001)
            return

        self.user = user
        self.group = _group_name(user.pk)

        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()
        await self._flush_unread()

    async def disconnect(self, code):
        if hasattr(self, 'group'):
            await self.channel_layer.group_discard(self.group, self.channel_name)

    async def receive(self, text_data=None, bytes_data=None):
        try:
            data = json.loads(text_data or '{}')
        except json.JSONDecodeError:
            logger.warning('NotificationConsumer: invalid JSON from user=%s', getattr(self, 'user', None))
            await self.close(code=4400)
            return

        msg_type = data.get('type')
        if msg_type == 'ping':
            await self.send(text_data=json.dumps({'type': 'pong'}))
        else:
            # All other client messages are ignored — this is a server-push channel
            logger.debug('NotificationConsumer: ignored message type=%s', msg_type)

    async def notification_push(self, event):
        await self.send(text_data=json.dumps({
            'type':       'notification',
            'id':         event.get('id', ''),
            'code':       event.get('code', ''),
            'title':      event.get('title', ''),
            'body':       event.get('body', ''),
            'data':       event.get('data', {}),
            'created_at': event.get('created_at', ''),
        }))

    # ── Helpers ──────────────────────────────────────────────────────────────

    async def _authenticate(self):
        from channels.db import database_sync_to_async

        query_string = self.scope.get('query_string', b'').decode()
        params = dict(p.split('=', 1) for p in query_string.split('&') if '=' in p)

        # Dev bypass — only when DEBUG=True and DEV_AUTH_BYPASS=True
        if (getattr(settings, 'DEBUG', False) and
                getattr(settings, 'DEV_AUTH_BYPASS', False)):
            email = params.get('email')
            if email:
                return await database_sync_to_async(self._get_user_by_email)(email)

        # Clerk JWT
        token = params.get('token')
        if not token:
            return None
        return await database_sync_to_async(self._get_user_from_jwt)(token)

    @staticmethod
    def _get_user_by_email(email: str):
        from apps.accounts.models import User
        try:
            return User.objects.get(email=email)
        except User.DoesNotExist:
            return None

    @staticmethod
    def _get_user_from_jwt(token: str):
        try:
            from apps.accounts.middleware.clerk_auth import _verify_clerk_token
            payload = _verify_clerk_token(token)
            if not payload:
                return None
            from apps.accounts.models import User
            return User.objects.get(clerk_id=payload.get('sub'))
        except Exception:
            return None

    async def _flush_unread(self):
        from channels.db import database_sync_to_async

        notifications = await database_sync_to_async(self._get_pending)(self.user)
        for n in notifications:
            await self.send(text_data=json.dumps({
                'type':       'notification',
                'id':         str(n['id']),
                'code':       n['code'],
                'title':      n['title'],
                'body':       n['body'],
                'data':       n['data'],
                'created_at': n['created_at'].isoformat(),
            }))

    @staticmethod
    def _get_pending(user):
        from .models import Notification
        return list(
            Notification.objects.filter(
                user=user,
                status=Notification.Status.PENDING,
                channel=Notification.Channel.PUSH,
            ).values('id', 'code', 'title', 'body', 'data', 'created_at')[:50]
        )
