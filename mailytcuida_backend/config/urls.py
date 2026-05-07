from django.conf import settings
from django.contrib import admin
from django.urls import path, include

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/v1/auth/', include('apps.accounts.urls')),
    path('api/v1/medications/', include('apps.medications.urls')),
    path('api/v1/meal-schedules/', include('apps.medications.meal_urls')),
    path('api/v1/vitals/', include('apps.vitals.urls')),
    path('api/v1/labs/', include('apps.lab_results.urls')),
    path('api/v1/appointments/', include('apps.appointments.urls')),
    path('api/v1/notifications/', include('apps.notifications.urls')),
    path('api/v1/chat/', include('apps.chat.urls')),
    path('api/v1/payments/',   include('apps.payments.urls')),
    path('api/v1/analytics/', include('apps.analytics.urls')),
    path('api/v1/documents/', include('apps.documents.urls')),
    path('api/v1/audit/',          include('apps.audit.urls')),
    path('api/v1/prescriptions/',  include('apps.prescriptions.urls')),
    path('api/v1/specialists/',    include('apps.specialists.urls')),
    path('api/v1/gamification/',   include('apps.gamification.urls')),
    path('api/v1/partners/',       include('apps.partners.urls')),
    path('api/v1/coupons/',        include('apps.coupons.urls')),
    path('api/v1/telemedicine/',   include('apps.telemedicine.urls')),
    path('api/v1/surveys/',        include('apps.surveys.urls')),
    path('api/v1/nutrition/',      include('apps.nutrition.urls')),
    path('api/v1/wellness/',       include('apps.wellness.urls')),
    path('api/v1/family-care/',    include('apps.family_care.urls')),
]

if settings.DEBUG:
    try:
        import debug_toolbar
        urlpatterns = [path('__debug__/', include(debug_toolbar.urls))] + urlpatterns
    except ImportError:
        pass
