from django.urls import path
from .views import (
    ConversationListCreateView, ConversationDetailView,
    MessageListCreateView, MarkReadView, UnreadCountView,
)

urlpatterns = [
    path('', ConversationListCreateView.as_view(), name='conversation-list'),
    path('unread-count/', UnreadCountView.as_view(), name='chat-unread-count'),
    path('<uuid:pk>/', ConversationDetailView.as_view(), name='conversation-detail'),
    path('<uuid:conversation_pk>/messages/', MessageListCreateView.as_view(), name='message-list'),
    path('<uuid:pk>/read/', MarkReadView.as_view(), name='conversation-read'),
]
