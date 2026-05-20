"""
admin_views.py
--------------
Vistas exclusivas para el rol ADMIN (portal web).
Solo accesibles con IsAdmin permission.
"""

import logging
from django.db.models import Count
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response

from core.permissions import IsAdmin
from .models import User

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
