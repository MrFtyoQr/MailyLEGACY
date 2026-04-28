from django.contrib import admin
from django.utils import timezone
from .models import SpecialistProfile, TeamMember, ReferralRequest, SpecialistReview


class TeamMemberInline(admin.TabularInline):
    model   = TeamMember
    extra   = 0
    readonly_fields = ('added_at',)
    raw_id_fields   = ('doctor',)


@admin.register(SpecialistProfile)
class SpecialistProfileAdmin(admin.ModelAdmin):
    list_display    = ('name', 'specialist_type', 'specialty_area', 'city',
                       'verification_status', 'is_active', 'created_at')
    list_filter     = ('specialist_type', 'specialty_area', 'verification_status', 'is_active')
    search_fields   = ('name', 'license_number', 'email', 'city')
    readonly_fields = ('id', 'created_at', 'updated_at', 'verified_at')
    raw_id_fields   = ('user', 'verified_by')
    inlines         = [TeamMemberInline]
    actions         = ['verify_selected', 'reject_selected']

    @admin.action(description='Verificar especialistas seleccionados')
    def verify_selected(self, request, queryset):
        queryset.update(
            verification_status='VERIFIED',
            verified_at=timezone.now(),
            verified_by=request.user,
        )

    @admin.action(description='Rechazar especialistas seleccionados')
    def reject_selected(self, request, queryset):
        queryset.update(verification_status='REJECTED')


@admin.register(TeamMember)
class TeamMemberAdmin(admin.ModelAdmin):
    list_display  = ('doctor', 'specialist', 'is_active', 'added_at')
    list_filter   = ('is_active',)
    raw_id_fields = ('doctor', 'specialist')


@admin.register(ReferralRequest)
class ReferralRequestAdmin(admin.ModelAdmin):
    list_display    = ('patient', 'specialist', 'doctor', 'status', 'urgency', 'created_at')
    list_filter     = ('status', 'urgency')
    search_fields   = ('patient__first_name', 'patient__last_name', 'specialist__name')
    readonly_fields = ('id', 'created_at', 'updated_at', 'accepted_at', 'completed_at')
    raw_id_fields   = ('doctor', 'patient', 'specialist', 'appointment')


@admin.register(SpecialistReview)
class SpecialistReviewAdmin(admin.ModelAdmin):
    list_display  = ('specialist', 'patient', 'rating', 'is_public', 'created_at')
    list_filter   = ('rating', 'is_public')
    raw_id_fields = ('referral', 'patient', 'specialist')
