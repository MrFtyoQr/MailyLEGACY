"""
admin_views.py
--------------
Vistas exclusivas para el rol ADMIN (portal web).
Solo accesibles con IsAdmin permission.
"""

import logging
from datetime import timedelta
from django.db import transaction
from django.db.models import Count, Max, Q
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import generics, permissions, status

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


# ── Admin: Expedir licencia manual ────────────────────────────────────────────

class AdminGrantSubscriptionView(APIView):
    """
    POST /api/v1/auth/admin/subscriptions/grant/
    { user_id, tier, months }
    Asigna o actualiza una suscripción activa sin pasar por Stripe.
    """
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def post(self, request):
        user_id = request.data.get('user_id', '').strip()
        tier    = request.data.get('tier', '').strip().upper()
        months  = int(request.data.get('months', 1))

        if tier not in ('FREE', 'SILVER', 'GOLD', 'PLATINUM'):
            return Response({'error': 'tier inválido'}, status=400)
        if months < 1 or months > 24:
            return Response({'error': 'months debe ser 1–24'}, status=400)

        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return Response({'error': 'Usuario no encontrado'}, status=404)

        try:
            from apps.payments.models import Plan, Subscription
            plan = Plan.objects.get(tier=tier)
        except Exception:
            return Response({'error': f'Plan {tier} no encontrado'}, status=404)

        sub, created = Subscription.objects.get_or_create(
            user=user,
            defaults={'plan': plan, 'status': 'ACTIVE'},
        )
        sub.plan                  = plan
        sub.status                = 'ACTIVE'
        sub.current_period_end    = timezone.now() + timedelta(days=30 * months)
        sub.cancel_at_period_end  = False
        sub.save(update_fields=['plan', 'status', 'current_period_end', 'cancel_at_period_end'])

        return Response({
            'detail':   f'Licencia {tier} otorgada por {months} mes(es)',
            'tier':     tier,
            'ends_at':  sub.current_period_end.isoformat(),
        })


# ── Admin: Enviar receta al paciente ─────────────────────────────────────────

class AdminSendPrescriptionView(APIView):
    """
    POST /api/v1/auth/admin/prescriptions/send/
    { patient_id, prescribed_by, notes, medications_listed, expires_at? }
    Crea una receta en nombre del admin y notifica al paciente.
    """
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def post(self, request):
        patient_id = request.data.get('patient_id', '').strip()
        if not patient_id:
            return Response({'error': 'patient_id requerido'}, status=400)

        try:
            patient = PatientProfile.objects.get(pk=patient_id)
        except PatientProfile.DoesNotExist:
            return Response({'error': 'Paciente no encontrado'}, status=404)

        from apps.prescriptions.models import Prescription, PrescriptionSource, PrescriptionStatus
        rx = Prescription.objects.create(
            patient       = patient,
            source        = PrescriptionSource.MAILYSOFT,
            prescribed_by = request.data.get('prescribed_by', ''),
            notes         = request.data.get('notes', ''),
            medications_listed = request.data.get('medications_listed', []),
            expires_at    = request.data.get('expires_at') or None,
            status        = PrescriptionStatus.ACTIVE,
            title         = request.data.get('title', 'Receta del portal de administración'),
        )

        # Notificar al paciente
        try:
            from apps.notifications.models import Notification
            Notification.objects.create(
                user       = patient.user,
                title      = '📋 Nueva receta disponible',
                body       = f'El administrador ha enviado una receta de {rx.prescribed_by or "tu médico"}.',
                notif_type = 'PRESCRIPTION_RECEIVED',
                data       = {'prescription_id': str(rx.pk)},
            )
        except Exception:
            logger.warning('AdminSendPrescription: no se pudo crear notificación')

        return Response({'detail': 'Receta enviada', 'prescription_id': str(rx.pk)},
                        status=status.HTTP_201_CREATED)


# ── Admin: Enviar resultados de laboratorio ───────────────────────────────────

class AdminSendLabResultView(APIView):
    """
    POST /api/v1/auth/admin/labs/send/
    {
      patient_id, panel_name, lab_name, performed_at,
      results: [{parameter, value, unit, ref_min?, ref_max?}]
    }
    """
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def post(self, request):
        patient_id = request.data.get('patient_id', '').strip()
        results    = request.data.get('results', [])

        if not patient_id:
            return Response({'error': 'patient_id requerido'}, status=400)
        if not results:
            return Response({'error': 'results no puede estar vacío'}, status=400)

        try:
            patient = PatientProfile.objects.get(pk=patient_id)
        except PatientProfile.DoesNotExist:
            return Response({'error': 'Paciente no encontrado'}, status=404)

        from apps.lab_results.models import LabPanel, LabResult
        with transaction.atomic():
            panel = LabPanel.objects.create(
                patient      = patient,
                panel_name   = request.data.get('panel_name', 'Resultados de laboratorio'),
                lab_name     = request.data.get('lab_name', ''),
                performed_at = request.data.get('performed_at', timezone.localdate()),
                source       = 'INTEGRATION',
                notes        = request.data.get('notes', ''),
            )
            for r in results:
                LabResult.objects.create(
                    patient      = patient,
                    panel        = panel,
                    parameter    = r.get('parameter', ''),
                    value        = r.get('value', 0),
                    unit         = r.get('unit', ''),
                    ref_min      = r.get('ref_min') or None,
                    ref_max      = r.get('ref_max') or None,
                    performed_at = panel.performed_at,
                    notes        = r.get('notes', ''),
                )

        # Notificar
        try:
            from apps.notifications.models import Notification
            Notification.objects.create(
                user       = patient.user,
                title      = '🔬 Nuevos resultados de laboratorio',
                body       = f'Se han cargado tus resultados de {panel.panel_name}.',
                notif_type = 'LAB_RESULT_NEW',
                data       = {'panel_id': str(panel.pk)},
            )
        except Exception:
            logger.warning('AdminSendLab: no se pudo crear notificación')

        return Response({'detail': 'Resultados enviados', 'panel_id': str(panel.pk)},
                        status=status.HTTP_201_CREATED)


# ── Admin: Especialistas ──────────────────────────────────────────────────────

class AdminSpecialistListView(APIView):
    """GET /api/v1/auth/admin/specialists/  — lista para el portal admin."""
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def get(self, request):
        from apps.specialists.models import SpecialistProfile
        qs = SpecialistProfile.objects.select_related('user').order_by('-created_at')

        vstatus   = request.query_params.get('status')
        specialty = request.query_params.get('specialty')
        search    = request.query_params.get('search', '').strip()

        if vstatus:
            qs = qs.filter(verification_status=vstatus.upper())
        if specialty:
            qs = qs.filter(specialty_area=specialty.upper())
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(email__icontains=search))

        page      = max(1, int(request.query_params.get('page', 1)))
        page_size = 20
        total     = qs.count()
        items     = qs[(page - 1) * page_size : page * page_size]

        results = [{
            'id':                  str(sp.pk),
            'name':                sp.name,
            'email':               sp.email,
            'specialist_type':     sp.specialist_type,
            'specialty_area':      sp.specialty_area,
            'license_number':      sp.license_number,
            'verification_status': sp.verification_status,
            'verified_at':         sp.verified_at.isoformat() if sp.verified_at else None,
            'is_active':           sp.is_active,
            'created_at':          sp.created_at.isoformat(),
            'avatar_url':          sp.avatar_url or None,
        } for sp in items]

        return Response({'count': total, 'page': page,
                         'pages': -(-total // page_size), 'results': results})


class AdminSpecialistVerifyView(APIView):
    """POST /api/v1/auth/admin/specialists/{pk}/verify/  { action: VERIFIED|REJECTED }"""
    permission_classes = [permissions.IsAuthenticated, IsAdmin]

    def post(self, request, pk):
        from apps.specialists.models import SpecialistProfile
        try:
            sp = SpecialistProfile.objects.get(pk=pk)
        except SpecialistProfile.DoesNotExist:
            return Response({'error': 'Especialista no encontrado'}, status=404)

        action = request.data.get('action', '').upper()
        if action not in ('VERIFIED', 'REJECTED'):
            return Response({'error': 'action debe ser VERIFIED o REJECTED'}, status=400)

        sp.verification_status = action
        if action == 'VERIFIED':
            sp.verified_at = timezone.now()
            sp.verified_by = request.user
        sp.save(update_fields=['verification_status', 'verified_at', 'verified_by'])

        return Response({'detail': f'Especialista {action.lower()}', 'status': action})
