"""
admin_views.py
--------------
Vistas exclusivas para el rol ADMIN (portal web).
Solo accesibles con IsAdmin permission.
"""

import logging
from django.db.models import Count, Max, Q
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import generics, permissions

from core.permissions import IsAdmin
from .models import User, PatientProfile

logger = logging.getLogger(__name__)


class AdminDashboardView(APIView):
    """
    GET /api/v1/auth/admin/dashboard/

    KPIs agregados de la plataforma para el portal de administración.

    Respuesta:
    {
      "users": {
        "total": 150,
        "by_role": {"PATIENT": 100, "DOCTOR": 30, ...},
        "new_today": 5
      },
      "specialists": {
        "total": 23,
        "pending": 8,
        "verified": 12,
        "rejected": 3
      },
      "subscriptions": {
        "active": 45,
        "by_tier": {"FREE": 60, "SILVER": 20, "GOLD": 15, "PLATINUM": 5}
      },
      "referrals": {
        "today": 3,
        "pending": 12
      }
    }
    """
    permission_classes = [IsAdmin]

    def get(self, request):
        today = timezone.localdate()

        # ── Users ─────────────────────────────────────────────────────────────
        user_qs   = User.objects.all()
        role_rows = (
            user_qs
            .values('role')
            .annotate(count=Count('id'))
        )
        by_role = {row['role']: row['count'] for row in role_rows}
        total_users    = sum(by_role.values())
        new_users_today = user_qs.filter(created_at__date=today).count()

        # ── Specialists ───────────────────────────────────────────────────────
        specialists_data = {'total': 0, 'pending': 0, 'verified': 0, 'rejected': 0}
        try:
            from apps.specialists.models import SpecialistProfile
            status_rows = (
                SpecialistProfile.objects
                .values('verification_status')
                .annotate(count=Count('id'))
            )
            for row in status_rows:
                key   = row['verification_status'].lower()
                count = row['count']
                specialists_data[key]  = count
                specialists_data['total'] += count
        except Exception:
            logger.warning('AdminDashboard: specialists module unavailable')

        # ── Subscriptions ─────────────────────────────────────────────────────
        subscriptions_data = {'active': 0, 'by_tier': {}}
        try:
            from apps.payments.models import Subscription
            sub_qs = Subscription.objects.filter(status='ACTIVE')
            subscriptions_data['active'] = sub_qs.count()
            tier_rows = (
                sub_qs
                .values('plan__tier')
                .annotate(count=Count('id'))
            )
            subscriptions_data['by_tier'] = {
                row['plan__tier'] or 'FREE': row['count']
                for row in tier_rows
            }
        except Exception:
            logger.warning('AdminDashboard: payments module unavailable')

        # ── Referrals ─────────────────────────────────────────────────────────
        referrals_data = {'today': 0, 'pending': 0}
        try:
            from apps.specialists.models import ReferralRequest
            referrals_data['today']   = ReferralRequest.objects.filter(
                created_at__date=today
            ).count()
            referrals_data['pending'] = ReferralRequest.objects.filter(
                status='PENDING'
            ).count()
        except Exception:
            logger.warning('AdminDashboard: referrals unavailable')

        return Response({
            'users': {
                'total':     total_users,
                'by_role':   by_role,
                'new_today': new_users_today,
            },
            'specialists': specialists_data,
            'subscriptions': subscriptions_data,
            'referrals': referrals_data,
        })


class AdminPatientListView(APIView):
    """
    GET /api/v1/auth/admin/patients/
    Lista de pacientes para monitoreo del portal de administración.

    Query params:
      search   — filtra por nombre o email
      ordering — last_activity | name | joined (default: last_activity)
      page     — paginación (20 por página)

    Respuesta por paciente:
    {
      id, email, first_name, last_name, photo_url,
      joined_at, plan_tier,
      last_vital_at, vital_count,
      medication_count, last_checkin_at,
      is_active
    }
    """
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def get(self, request):
        search   = request.query_params.get('search', '').strip()
        ordering = request.query_params.get('ordering', 'last_activity')
        page     = max(1, int(request.query_params.get('page', 1)))
        page_size = 20

        # Base queryset — solo pacientes
        qs = User.objects.filter(role='PATIENT', is_active=True).select_related(
            'patient_profile'
        )

        # Búsqueda
        if search:
            qs = qs.filter(
                Q(email__icontains=search) |
                Q(patient_profile__first_name__icontains=search) |
                Q(patient_profile__last_name__icontains=search)
            )

        # Anotar última actividad (último vital)
        # User → PatientProfile → vital_signs (related_name en VitalSign.patient)
        try:
            qs = qs.annotate(
                last_vital_at=Max('patient_profile__vital_signs__recorded_at'),
                vital_count=Count('patient_profile__vital_signs', distinct=True),
            )
        except Exception:
            pass

        try:
            qs = qs.annotate(
                medication_count=Count('patient_profile__medications', distinct=True),
            )
        except Exception:
            pass

        # Ordenamiento
        order_map = {
            'last_activity': '-last_vital_at',
            'name':          'patient_profile__first_name',
            'joined':        '-created_at',
        }
        qs = qs.order_by(order_map.get(ordering, '-created_at'))

        # Paginación manual
        total   = qs.count()
        offset  = (page - 1) * page_size
        patients = qs[offset:offset + page_size]

        # Plan tier
        plan_tiers: dict = {}
        try:
            from apps.payments.models import Subscription
            subs = Subscription.objects.filter(
                patient__user__in=[p for p in patients],
                status='ACTIVE'
            ).select_related('plan', 'patient__user')
            plan_tiers = {s.patient.user_id: s.plan.tier for s in subs}
        except Exception:
            pass

        results = []
        for p in patients:
            profile = getattr(p, 'patient_profile', None)
            results.append({
                'id':               str(p.id),
                'email':            p.email,
                'first_name':       getattr(profile, 'first_name', '') or '',
                'last_name':        getattr(profile, 'last_name',  '') or '',
                'photo_url':        getattr(profile, 'photo_url',  None),
                'joined_at':        p.created_at.isoformat(),
                'plan_tier':        plan_tiers.get(p.id, 'FREE'),
                'last_vital_at':    getattr(p, 'last_vital_at',    None),
                'vital_count':      getattr(p, 'vital_count',       0),
                'medication_count': getattr(p, 'medication_count',  0),
                'is_active':        p.is_active,
            })

        return Response({
            'count':    total,
            'page':     page,
            'pages':    -(-total // page_size),  # ceil division
            'results':  results,
        })
