from django.contrib import admin
from .models import Conversation, Message


class MessageInline(admin.TabularInline):
    model = Message
    extra = 0
    fields = ('sender', 'message_type', 'text', 'is_read', 'created_at')
    readonly_fields = ('created_at',)


@admin.register(Conversation)
class ConversationAdmin(admin.ModelAdmin):
    list_display  = ('patient', 'doctor', 'is_active', 'updated_at')
    list_filter   = ('is_active',)
    search_fields = (
        'patient__first_name', 'patient__last_name',
        'doctor__first_name',  'doctor__last_name',
    )
    inlines = [MessageInline]


@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display   = ('conversation', 'sender', 'message_type', 'is_read', 'created_at')
    list_filter    = ('message_type', 'is_read')
    search_fields  = ('sender__email', 'text')
    date_hierarchy = 'created_at'
    readonly_fields = ('created_at',)
