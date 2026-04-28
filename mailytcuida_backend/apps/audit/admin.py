from django.contrib import admin
from .models import AuditLog


@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display   = ('created_at', 'actor_email', 'actor_role', 'action',
                      'resource_type', 'resource_id', 'ip_address', 'http_status')
    list_filter    = ('action', 'resource_type', 'actor_role', 'http_status')
    search_fields  = ('actor_email', 'resource_id', 'note', 'endpoint')
    date_hierarchy = 'created_at'
    readonly_fields = (
        'id', 'actor', 'actor_role', 'actor_email',
        'action', 'resource_type', 'resource_id', 'patient',
        'ip_address', 'user_agent', 'endpoint', 'http_status',
        'changed_fields', 'note', 'created_at',
    )

    # Disable add / change / delete in admin — audit log is immutable
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
