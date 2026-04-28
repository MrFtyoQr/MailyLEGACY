from django.contrib import admin
from .models import DeviceToken, Notification


@admin.register(DeviceToken)
class DeviceTokenAdmin(admin.ModelAdmin):
    list_display  = ('user', 'platform', 'is_active', 'created_at')
    list_filter   = ('platform', 'is_active')
    search_fields = ('user__email',)


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display   = ('user', 'code', 'channel', 'status', 'sent_at', 'created_at')
    list_filter    = ('code', 'channel', 'status')
    search_fields  = ('user__email', 'title')
    date_hierarchy = 'created_at'
    readonly_fields = ('sent_at', 'read_at', 'error', 'created_at')
