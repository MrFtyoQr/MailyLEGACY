from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated

from .models import DeviceToken, Notification
from .serializers import DeviceTokenSerializer, NotificationSerializer, UnreadCountSerializer


class NotifPagination(PageNumberPagination):
    page_size = 30
    page_size_query_param = 'page_size'
    max_page_size = 100


# ── Notifications ─────────────────────────────────────────────────────────────

class NotificationListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = NotificationSerializer
    pagination_class = NotifPagination

    def get_queryset(self):
        qs = Notification.objects.filter(user=self.request.user)
        channel = self.request.query_params.get('channel')
        unread  = self.request.query_params.get('unread')
        if channel:
            qs = qs.filter(channel=channel)
        if unread in ('1', 'true'):
            qs = qs.exclude(status=Notification.Status.READ)
        return qs


class UnreadCountView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        count = Notification.objects.filter(
            user=request.user,
        ).exclude(status=Notification.Status.READ).count()
        return Response(UnreadCountSerializer({'unread': count}).data)


class MarkReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        notif = get_object_or_404(Notification, pk=pk, user=request.user)
        if notif.status != Notification.Status.READ:
            notif.status  = Notification.Status.READ
            notif.read_at = timezone.now()
            notif.save(update_fields=['status', 'read_at'])
        return Response(NotificationSerializer(notif).data)


class MarkAllReadView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        now = timezone.now()
        count = Notification.objects.filter(
            user=request.user,
        ).exclude(status=Notification.Status.READ).update(
            status=Notification.Status.READ,
            read_at=now,
        )
        return Response({'marked_read': count})


# ── Device tokens ─────────────────────────────────────────────────────────────

class DeviceTokenCreateView(generics.CreateAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class = DeviceTokenSerializer

    def get_serializer_context(self):
        ctx = super().get_serializer_context()
        ctx['request'] = self.request
        return ctx


class DeviceTokenDeleteView(generics.DestroyAPIView):
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return DeviceToken.objects.filter(user=self.request.user)

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=['is_active'])
