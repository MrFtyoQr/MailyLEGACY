from django.shortcuts import get_object_or_404
from django.utils import timezone
from datetime import date, timedelta
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response

from core.permissions import IsPatient, IsDoctor, IsDoctorOfPatient
from .models import AdherenceReport, HealthInsight
from .serializers import (
    AdherenceReportSerializer, HealthInsightSerializer,
    InsightGenerateSerializer, DashboardSerializer,
)
from .engine import calculate_adherence, build_health_context, get_patient_tier


# ── Patient Dashboard ─────────────────────────────────────────────────────────

class PatientDashboardView(APIView):
    permission_classes = [IsPatient]

    def get(self, request):
        patient = request.user.patient_profile
        today   = date.today()

        # ── Adherence ─────────────────────────────────────────────────────────
        adherence_dict = calculate_adherence(patient, days=7)
        # Promediar en un solo número para el frontend (0-100)
        adherence_pct = None
        if adherence_dict:
            vals = [v for v in adherence_dict.values() if isinstance(v, (int, float))]
            adherence_pct = round(sum(vals) / len(vals)) if vals else None

        # ── Vitales recientes ─────────────────────────────────────────────────
        from apps.vitals.models import VitalSign
        vitals_qs = VitalSign.objects.filter(patient=patient).order_by('vital_type', '-recorded_at')
        seen, latest_vitals = set(), []
        for v in vitals_qs:
            if v.vital_type not in seen:
                seen.add(v.vital_type)
                latest_vitals.append({
                    'vital_type':  v.vital_type,
                    'value':       float(v.value),
                    'unit':        v.unit,
                    'recorded_at': v.recorded_at.isoformat(),
                })

        # ── Medicamentos tomados hoy ──────────────────────────────────────────
        from apps.medications.models import MedicationHistory
        today_history = MedicationHistory.objects.filter(patient=patient, scheduled_date=today)
        meds_taken = today_history.filter(status='TAKEN').count()
        meds_total = today_history.count()

        # ── Racha de días consecutivos con vital registrado ───────────────────
        streak_days = 0
        check_date  = today
        for _ in range(365):
            has_vital = VitalSign.objects.filter(
                patient=patient,
                recorded_at__date=check_date,
            ).exists()
            if has_vital:
                streak_days += 1
                check_date -= timedelta(days=1)
            else:
                break

        # ── Próxima cita ──────────────────────────────────────────────────────
        next_appt = patient.appointments.filter(
            scheduled_at__gt=timezone.now(),
            status__in=['PENDING', 'CONFIRMED'],
        ).order_by('scheduled_at').first()
        next_appt_data = None
        if next_appt:
            next_appt_data = {
                'id':           str(next_appt.pk),
                'scheduled_at': next_appt.scheduled_at.isoformat(),
                'doctor_name':  f'{next_appt.doctor.first_name} {next_appt.doctor.last_name}',
                'specialty':    getattr(next_appt.doctor, 'specialty', ''),
                'type':         next_appt.appointment_type,
                'status':       next_appt.status,
            }

        # ── Labs anormales ────────────────────────────────────────────────────
        from apps.lab_results.models import LabResult
        abnormal_count = LabResult.objects.filter(
            patient=patient,
            performed_at__gte=today - timedelta(days=90),
            status__in=['ABNORMAL_LOW', 'ABNORMAL_HIGH', 'CRITICAL'],
        ).count()

        # ── Último insight ────────────────────────────────────────────────────
        last_insight = HealthInsight.objects.filter(patient=patient).order_by('-generated_at').first()

        return Response({
            # Formato que consume el frontend de la app móvil
            'medications_today': {
                'taken':  meds_taken,
                'missed': meds_total - meds_taken,
                'total':  meds_total,
            },
            'streak_days':      streak_days,
            'adherence_pct':    adherence_pct,
            'next_appointment': next_appt_data,
            'latest_vitals':    latest_vitals,
            'abnormal_labs':    abnormal_count,
            'last_insight': {
                'id':            str(last_insight.pk),
                'insight_type':  last_insight.insight_type,
                'title':         last_insight.title,
                'content':       last_insight.content,
                'generated_at':  last_insight.generated_at.isoformat(),
            } if last_insight else None,
            # Compat — mantener campos legacy que otros endpoints puedan usar
            'adherence_7d':       adherence_dict,
            'active_medications': patient.medications.filter(is_active=True).count(),
        })


# ── Adherence ─────────────────────────────────────────────────────────────────

class AdherenceView(APIView):
    permission_classes = [IsPatient]

    def get(self, request):
        days = int(request.query_params.get('days', 7))
        if days not in (7, 30, 90):
            days = 7
        data = calculate_adherence(request.user.patient_profile, days=days)
        return Response(data)


class AdherenceReportListView(generics.ListAPIView):
    permission_classes = [IsPatient]
    serializer_class = AdherenceReportSerializer

    def get_queryset(self):
        return AdherenceReport.objects.filter(patient=self.request.user.patient_profile)


# ── Insights ──────────────────────────────────────────────────────────────────

class InsightListView(generics.ListAPIView):
    permission_classes = [IsPatient]
    serializer_class = HealthInsightSerializer

    def get_queryset(self):
        qs = HealthInsight.objects.filter(patient=self.request.user.patient_profile)
        insight_type = self.request.query_params.get('type')
        if insight_type:
            qs = qs.filter(insight_type=insight_type)
        return qs


class InsightGenerateView(APIView):
    permission_classes = [IsPatient]

    def post(self, request):
        serializer = InsightGenerateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        insight_type = serializer.validated_data['insight_type']
        patient = request.user.patient_profile

        from .tasks import generate_patient_insight
        generate_patient_insight.delay(str(patient.pk), insight_type)

        return Response(
            {'detail': 'Insight en generación. Disponible en unos momentos.'},
            status=status.HTTP_202_ACCEPTED,
        )


# ── Doctor view ───────────────────────────────────────────────────────────────

class DoctorPatientDashboardView(APIView):
    permission_classes = [IsDoctor, IsDoctorOfPatient]

    def get(self, request, patient_id):
        from apps.accounts.models import PatientProfile
        patient = get_object_or_404(PatientProfile, pk=patient_id)
        self.check_object_permissions(request, patient)

        adherence = calculate_adherence(patient, days=7)

        from apps.vitals.models import VitalSign
        vitals_qs = VitalSign.objects.filter(patient=patient).order_by('vital_type', '-recorded_at')
        seen, latest_vitals = set(), []
        for v in vitals_qs:
            if v.vital_type not in seen:
                seen.add(v.vital_type)
                latest_vitals.append({
                    'vital_type':  v.vital_type,
                    'value':       float(v.value),
                    'unit':        v.unit,
                    'recorded_at': v.recorded_at.isoformat(),
                })

        from apps.lab_results.models import LabResult
        abnormal_count = LabResult.objects.filter(
            patient=patient,
            performed_at__gte=date.today() - timedelta(days=90),
            status__in=['ABNORMAL_LOW', 'ABNORMAL_HIGH', 'CRITICAL'],
        ).count()

        next_appt = patient.appointments.filter(
            scheduled_at__gt=timezone.now(),
            status__in=['PENDING', 'CONFIRMED'],
        ).order_by('scheduled_at').first()
        next_appt_data = None
        if next_appt:
            next_appt_data = {
                'id':           str(next_appt.pk),
                'scheduled_at': next_appt.scheduled_at.isoformat(),
                'doctor_name':  f'{next_appt.doctor.first_name} {next_appt.doctor.last_name}',
                'type':         next_appt.appointment_type,
                'status':       next_appt.status,
            }

        last_insight = HealthInsight.objects.filter(patient=patient).first()

        data = {
            'adherence_7d':       adherence,
            'latest_vitals':      latest_vitals,
            'active_medications': patient.medications.filter(is_active=True).count(),
            'next_appointment':   next_appt_data,
            'abnormal_labs':      abnormal_count,
            'last_insight':       last_insight,
        }
        return Response(DashboardSerializer(data).data)
