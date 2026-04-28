from django.urls import path
from .views import (
    NotificationListView, UnreadCountView,
    MarkReadView, MarkAllReadView,
    DeviceTokenCreateView, DeviceTokenDeleteView,
)

urlpatterns = [
    path('', NotificationListView.as_view(), name='notification-list'),
    path('unread-count/', UnreadCountView.as_view(), name='notification-unread-count'),
    path('read-all/', MarkAllReadView.as_view(), name='notification-read-all'),
    path('<uuid:pk>/read/', MarkReadView.as_view(), name='notification-read'),

    path('device-token/', DeviceTokenCreateView.as_view(), name='device-token-create'),
    path('device-token/<uuid:pk>/', DeviceTokenDeleteView.as_view(), name='device-token-delete'),
]
