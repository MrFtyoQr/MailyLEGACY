from django.contrib import admin
from .models import PartnerOrganization, PartnerAdmin, MemberEnrollment, PartnerHealthSnapshot


class PartnerAdminInline(admin.TabularInline):
    model         = PartnerAdmin
    extra         = 0
    raw_id_fields = ('user',)


class MemberEnrollmentInline(admin.TabularInline):
    model           = MemberEnrollment
    extra           = 0
    readonly_fields = ('enrolled_at', 'consent_at')
    raw_id_fields   = ('patient',)
    fields          = ('patient', 'employee_id', 'consent', 'consent_at', 'is_active', 'enrolled_at')


@admin.register(PartnerOrganization)
class PartnerOrganizationAdmin(admin.ModelAdmin):
    list_display  = ('name', 'rfc', 'status', 'max_members', 'monthly_fee_mxn',
                     'agreement_start', 'agreement_end', 'created_at')
    list_filter   = ('status',)
    search_fields = ('name', 'rfc', 'contact_email')
    readonly_fields = ('id', 'created_at', 'updated_at')
    filter_horizontal = ('preferred_doctors',)
    inlines       = [PartnerAdminInline, MemberEnrollmentInline]


@admin.register(MemberEnrollment)
class MemberEnrollmentAdmin(admin.ModelAdmin):
    list_display  = ('patient', 'organization', 'employee_id', 'consent', 'is_active', 'enrolled_at')
    list_filter   = ('consent', 'is_active')
    raw_id_fields = ('patient', 'organization')
    readonly_fields = ('id', 'enrolled_at', 'consent_at')


@admin.register(PartnerHealthSnapshot)
class PartnerHealthSnapshotAdmin(admin.ModelAdmin):
    list_display  = ('organization', 'period_start', 'period_end',
                     'consenting_members', 'avg_adherence_pct', 'created_at')
    list_filter   = ('organization',)
    readonly_fields = ('id', 'created_at')
    raw_id_fields   = ('organization',)
