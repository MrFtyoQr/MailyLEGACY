from django.urls import path
from .views import (
    MeView, RoleView, AuthInitView,
    PatientProfileView, PatientPhotoView,
    DoctorProfileView, DoctorPhotoView,
    SpecialistProfileView, PartnerProfileView,
    DoctorPatientListCreateView, DoctorPatientDetailView,
    AdminUserListView, AdminUserDetailView,
)
from .admin_views import AdminDashboardView, AdminPatientListView
from .webhooks.clerk_webhooks import ClerkWebhookView
from .auth_views import (
    RegisterView, LoginView, LogoutView,
    SetPasswordView, NativeTokenRefreshView,
)

urlpatterns = [
    # ── Auth propio (JWT nativo) ──────────────────────────────────────────────
    path('register/',     RegisterView.as_view(),           name='auth-register'),
    path('login/',        LoginView.as_view(),              name='auth-login'),
    path('logout/',       LogoutView.as_view(),             name='auth-logout'),
    path('refresh/',      NativeTokenRefreshView.as_view(), name='auth-refresh'),
    path('set-password/', SetPasswordView.as_view(),        name='auth-set-password'),

    # ── Clerk webhook (LEGADO — conservar para migración) ─────────────────────
    path('webhook/clerk/', ClerkWebhookView.as_view(), name='clerk-webhook'),

    # ── Clerk init (LEGADO) ───────────────────────────────────────────────────
    path('init/', AuthInitView.as_view(), name='auth-init'),

    # ── Usuario autenticado ────────────────────────────────────────────────────
    path('me/', MeView.as_view(), name='auth-me'),
    path('me/role/', RoleView.as_view(), name='auth-role'),

    # ── Perfiles por rol ───────────────────────────────────────────────────────
    path('profiles/patient/', PatientProfileView.as_view(), name='profile-patient'),
    path('profiles/patient/photo/', PatientPhotoView.as_view(), name='profile-patient-photo'),
    path('profiles/doctor/', DoctorProfileView.as_view(), name='profile-doctor'),
    path('profiles/doctor/photo/', DoctorPhotoView.as_view(), name='profile-doctor-photo'),
    path('profiles/specialist/', SpecialistProfileView.as_view(), name='profile-specialist'),
    path('profiles/partner/', PartnerProfileView.as_view(), name='profile-partner'),

    # ── Doctor — gestión de pacientes ─────────────────────────────────────────
    path('doctor/patients/', DoctorPatientListCreateView.as_view(), name='doctor-patients'),
    path('doctor/patients/<uuid:pk>/', DoctorPatientDetailView.as_view(), name='doctor-patient-detail'),

    # ── Admin ──────────────────────────────────────────────────────────────────
    path('admin/users/', AdminUserListView.as_view(), name='admin-users'),
    path('admin/users/<uuid:pk>/', AdminUserDetailView.as_view(), name='admin-user-detail'),
    path('admin/dashboard/', AdminDashboardView.as_view(),    name='admin-dashboard'),
    path('admin/patients/',  AdminPatientListView.as_view(), name='admin-patients'),
]
