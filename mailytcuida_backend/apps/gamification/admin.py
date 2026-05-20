from django.contrib import admin
from .models import Badge, PlayerProfile, PointTransaction, PlayerBadge, RewardProduct


@admin.register(Badge)
class BadgeAdmin(admin.ModelAdmin):
    list_display  = ('code', 'name', 'category', 'threshold', 'points_reward', 'is_active')
    list_filter   = ('category', 'is_active')
    search_fields = ('code', 'name')


class PlayerBadgeInline(admin.TabularInline):
    model          = PlayerBadge
    extra          = 0
    readonly_fields = ('badge', 'earned_at')
    can_delete     = False


@admin.register(PlayerProfile)
class PlayerProfileAdmin(admin.ModelAdmin):
    list_display  = ('patient', 'total_points', 'level',
                     'current_streak', 'longest_streak', 'last_activity_date')
    list_filter   = ('level',)
    search_fields = ('patient__first_name', 'patient__last_name')
    readonly_fields = ('id', 'created_at', 'updated_at')
    raw_id_fields  = ('patient',)
    inlines        = [PlayerBadgeInline]


@admin.register(PointTransaction)
class PointTransactionAdmin(admin.ModelAdmin):
    list_display  = ('player', 'source', 'base_points', 'multiplier',
                     'points', 'note', 'created_at')
    list_filter   = ('source',)
    search_fields = ('player__patient__first_name', 'player__patient__last_name')
    readonly_fields = ('id', 'player', 'source', 'base_points', 'multiplier',
                       'points', 'ref_id', 'note', 'created_at')

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(RewardProduct)
class RewardProductAdmin(admin.ModelAdmin):
    list_display  = ('name', 'points_cost', 'stock', 'is_active', 'created_at')
    list_filter   = ('is_active',)
    search_fields = ('name', 'description')
    readonly_fields = ('id', 'created_at', 'updated_at')
    fieldsets = (
        (None, {
            'fields': ('id', 'name', 'description', 'image_url'),
        }),
        ('Canje', {
            'fields': ('points_cost', 'stock', 'is_active'),
        }),
        ('Fechas', {
            'fields': ('created_at', 'updated_at'),
        }),
    )
