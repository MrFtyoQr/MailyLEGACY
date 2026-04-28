from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from .models import User, PatientProfile, DoctorProfile, DoctorPatient, SpecialistProfile, PartnerProfile


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('email', 'role', 'is_active', 'created_at')
    list_filter = ('role', 'is_active')
    search_fields = ('email', 'clerk_id')
    ordering = ('-created_at',)
    fieldsets = (
        (None, {'fields': ('email', 'clerk_id', 'role', 'phone')}),
        ('Permisos', {'fields': ('is_active', 'is_staff', 'is_superuser', 'groups', 'user_permissions')}),
    )
    add_fieldsets = (
        (None, {'fields': ('email', 'clerk_id', 'role')}),
    )


@admin.register(PatientProfile)
class PatientProfileAdmin(admin.ModelAdmin):
    list_display = ('first_name', 'last_name', 'user', 'created_at')
    search_fields = ('first_name', 'last_name', 'user__email')


@admin.register(DoctorProfile)
class DoctorProfileAdmin(admin.ModelAdmin):
    list_display = ('first_name', 'last_name', 'specialty', 'license_number')
    search_fields = ('first_name', 'last_name', 'license_number')


@admin.register(DoctorPatient)
class DoctorPatientAdmin(admin.ModelAdmin):
    list_display = ('doctor', 'patient', 'is_active', 'assigned_at')
    list_filter = ('is_active',)


@admin.register(SpecialistProfile)
class SpecialistProfileAdmin(admin.ModelAdmin):
    list_display = ('first_name', 'last_name', 'specialty_type', 'is_available')
    list_filter = ('specialty_type', 'is_available')
    search_fields = ('first_name', 'last_name', 'user__email')


@admin.register(PartnerProfile)
class PartnerProfileAdmin(admin.ModelAdmin):
    list_display = ('business_name', 'contact_email', 'is_active')
    list_filter = ('is_active',)
    search_fields = ('business_name', 'contact_email')
