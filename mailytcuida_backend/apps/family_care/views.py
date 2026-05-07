import logging
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import FamilyCareLink, VitalMonitorConfig, CareAlert, MedicationPayment
from .permissions import get_active_link_for_caregiver
from .serializers import (
    FamilyCareLinkCreateSerializer, FamilyCareLinkSerializer,
    VitalMonitorConfigSerializer, VitalSignReadSerializer, VitalFrequencySerializer,
    AppointmentReadSerializer, CareAlertSerializer, DispatchDoctorSerializer,
    MedicationPaymentSerializer, MedicationPaymentCreateSerializer,
)

logger = logging.getLogger(__name__)


# ── Links ─────────────────────────────────────────────────────────────────────

class FamilyCareLinkListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        return FamilyCareLinkCreateSerializer if self.request.method == 'POST' else FamilyCareLinkSerializer

    def get_queryset(self):
        user = self.request.user
        return FamilyCareLink.objects.filter(
            caregiver=user
        ) | FamilyCareLink.objects.filter(patient=user)

    def perform_create(self, serializer):
        link = serializer.save()
        from apps.notifications.service import notify
        notify(
            user=link.patient,
            code='FAMILY_CARE_REQUEST',
            context={
                'caregiver_email': link.caregiver.email,
                'relationship': link.get_relationship_type_display(),
            },
            channel='PUSH',
        )


class FamilyCareLinkAcceptView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        link = FamilyCareLink.objects.filter(
            pk=pk, patient=request.user, status=FamilyCareLink.Status.PENDING_CONSENT
        ).first()
        if not link:
            return Response({'detail': 'Solicitud no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
        link.status = FamilyCareLink.Status.ACTIVE
        link.consent_at = timezone.now()
        link.save(update_fields=['status', 'consent_at'])
        return Response(FamilyCareLinkSerializer(link).data)


class FamilyCareLinkRevokeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        link = FamilyCareLink.objects.filter(pk=pk, status=FamilyCareLink.Status.ACTIVE).filter(
            caregiver=request.user
        ).first() or FamilyCareLink.objects.filter(
            pk=pk, status=FamilyCareLink.Status.ACTIVE, patient=request.user
        ).first()
        if not link:
            return Response({'detail': 'Vínculo no encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        link.status = FamilyCareLink.Status.REVOKED
        link.revoked_at = timezone.now()
        link.save(update_fields=['status', 'revoked_at'])
        return Response({'detail': 'Vínculo revocado.'})


# ── Patient data views (caregiver reads patient data) ─────────────────────────

class PatientVitalListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        link = get_active_link_for_caregiver(pk, request.user)
        if not link:
            return Response({'detail': 'Acceso no autorizado.'}, status=status.HTTP_403_FORBIDDEN)
        if not link.permissions.get('vitals'):
            return Response({'detail': 'Sin permiso para ver signos vitales.'}, status=status.HTTP_403_FORBIDDEN)

        from apps.vitals.models import VitalSign
        # FamilyCareLink.patient → User; VitalSign.patient → PatientProfile
        vitals = VitalSign.objects.filter(
            patient__user=link.patient
        ).order_by('-recorded_at')[:50]
        return Response(VitalSignReadSerializer(vitals, many=True).data)


class PatientVitalFrequencyView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        link = get_active_link_for_caregiver(pk, request.user)
        if not link:
            return Response({'detail': 'Acceso no autorizado.'}, status=status.HTTP_403_FORBIDDEN)
        if not link.permissions.get('vitals'):
            return Response({'detail': 'Sin permiso para ver signos vitales.'}, status=status.HTTP_403_FORBIDDEN)

        from apps.vitals.models import VitalSign
        from datetime import timedelta
        now = timezone.now()
        result = []

        configs_by_vital = {c.vital_type: c for c in link.monitor_configs.filter(is_active=True)}

        for vital_type, display in VitalSign.VitalType.choices:
            qs = VitalSign.objects.filter(patient__user=link.patient, vital_type=vital_type)
            last = qs.order_by('-recorded_at').first()
            result.append({
                'vital_type':         vital_type,
                'vital_type_display': display,
                'last_24h':           qs.filter(recorded_at__gte=now - timedelta(hours=24)).count(),
                'last_7d':            qs.filter(recorded_at__gte=now - timedelta(days=7)).count(),
                'last_30d':           qs.filter(recorded_at__gte=now - timedelta(days=30)).count(),
                'last_reading_at':    last.recorded_at if last else None,
                'monitor_config':     configs_by_vital.get(vital_type),
            })

        return Response(VitalFrequencySerializer(result, many=True).data)


class PatientMedicationView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        link = get_active_link_for_caregiver(pk, request.user)
        if not link:
            return Response({'detail': 'Acceso no autorizado.'}, status=status.HTTP_403_FORBIDDEN)
        if not link.permissions.get('medications'):
            return Response({'detail': 'Sin permiso para ver medicamentos.'}, status=status.HTTP_403_FORBIDDEN)

        from apps.medications.models import Medication, MedicationHistory
        from datetime import timedelta
        now = timezone.now()
        meds = Medication.objects.filter(patient__user=link.patient, is_active=True)
        data = []
        for med in meds:
            total = MedicationHistory.objects.filter(
                medication=med, scheduled_at__gte=now - timedelta(days=7)
            ).count()
            taken = MedicationHistory.objects.filter(
                medication=med,
                scheduled_at__gte=now - timedelta(days=7),
                status='TAKEN',
            ).count()
            adherence = round((taken / total * 100) if total else 0, 1)
            data.append({
                'id': str(med.id), 'name': med.name, 'dosage': med.dosage,
                'unit': med.unit,
                'is_active': med.is_active, 'adherence_7d': adherence,
            })
        return Response(data)


class PatientAppointmentView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        link = get_active_link_for_caregiver(pk, request.user)
        if not link:
            return Response({'detail': 'Acceso no autorizado.'}, status=status.HTTP_403_FORBIDDEN)
        if not link.permissions.get('appointments'):
            return Response({'detail': 'Sin permiso para ver citas.'}, status=status.HTTP_403_FORBIDDEN)

        from apps.appointments.models import Appointment
        appointments = (
            Appointment.objects
            .filter(patient__user=link.patient)
            .select_related('doctor__user', 'clinical_note')
            .order_by('-scheduled_at')[:20]
        )
        result = []
        for appt in appointments:
            note = getattr(appt, 'clinical_note', None)
            result.append({
                'id': str(appt.id),
                'doctor_name': f"{appt.doctor.first_name} {appt.doctor.last_name}".strip() if appt.doctor else '',
                'specialty': appt.doctor.specialty if appt.doctor else '',
                'appointment_type': appt.appointment_type,
                'status': appt.status,
                'scheduled_at': appt.scheduled_at,
                'note': {
                    'chief_complaint': note.chief_complaint,
                    'diagnosis': note.diagnosis,
                    'treatment_plan': note.treatment_plan,
                } if note else None,
            })
        return Response(result)


# ── Monitor Configs ───────────────────────────────────────────────────────────

class VitalMonitorConfigListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        link = get_active_link_for_caregiver(pk, request.user)
        if not link:
            return Response({'detail': 'Acceso no autorizado.'}, status=status.HTTP_403_FORBIDDEN)
        configs = link.monitor_configs.all()
        return Response(VitalMonitorConfigSerializer(configs, many=True).data)

    def post(self, request, pk):
        link = get_active_link_for_caregiver(pk, request.user)
        if not link:
            return Response({'detail': 'Acceso no autorizado.'}, status=status.HTTP_403_FORBIDDEN)
        serializer = VitalMonitorConfigSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(care_link=link)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class VitalMonitorConfigDetailView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_config(self, pk, cfg_id, user):
        link = get_active_link_for_caregiver(pk, user)
        if not link:
            return None, None
        config = VitalMonitorConfig.objects.filter(pk=cfg_id, care_link=link).first()
        return link, config

    def patch(self, request, pk, cfg_id):
        _, config = self._get_config(pk, cfg_id, request.user)
        if not config:
            return Response({'detail': 'Configuración no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
        serializer = VitalMonitorConfigSerializer(config, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def delete(self, request, pk, cfg_id):
        _, config = self._get_config(pk, cfg_id, request.user)
        if not config:
            return Response({'detail': 'Configuración no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
        config.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ── Alerts ────────────────────────────────────────────────────────────────────

class CareAlertListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        link = get_active_link_for_caregiver(pk, request.user)
        if not link:
            return Response({'detail': 'Acceso no autorizado.'}, status=status.HTTP_403_FORBIDDEN)
        alerts = link.alerts.filter(status=CareAlert.Status.OPEN).order_by('-created_at')
        return Response(CareAlertSerializer(alerts, many=True).data)


class DispatchDoctorView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk, alert_id):
        link = get_active_link_for_caregiver(pk, request.user)
        if not link:
            return Response({'detail': 'Acceso no autorizado.'}, status=status.HTTP_403_FORBIDDEN)
        if not link.permissions.get('can_dispatch_doctor'):
            return Response({'detail': 'Sin permiso para despachar médico.'}, status=status.HTTP_403_FORBIDDEN)

        alert = CareAlert.objects.filter(pk=alert_id, care_link=link, status=CareAlert.Status.OPEN).first()
        if not alert:
            return Response({'detail': 'Alerta no encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        serializer = DispatchDoctorSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        d = serializer.validated_data

        from apps.appointments.models import Appointment
        from apps.accounts.models import DoctorPatient, PatientProfile
        try:
            patient_profile = link.patient.patient_profile
        except PatientProfile.DoesNotExist:
            return Response({'detail': 'Perfil de paciente no encontrado.'}, status=status.HTTP_400_BAD_REQUEST)

        doctor_rel = DoctorPatient.objects.filter(patient=patient_profile, is_active=True).first()
        if not doctor_rel:
            return Response(
                {'detail': 'El paciente no tiene médico asignado.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        appointment = Appointment.objects.create(
            patient=patient_profile,
            doctor=doctor_rel.doctor,
            appointment_type=d['appointment_type'],
            status='SCHEDULED',
            scheduled_at=d['scheduled_at'],
            reason=d['reason'],
        )
        alert.status = CareAlert.Status.DISPATCHED_DOCTOR
        alert.appointment = appointment
        alert.resolved_at = timezone.now()
        alert.save(update_fields=['status', 'appointment', 'resolved_at'])

        from apps.notifications.service import notify
        notify(
            user=link.patient,
            code='FAMILY_DOCTOR_DISPATCHED',
            context={
                'caregiver_email': link.caregiver.email,
                'doctor_name': doctor_rel.doctor.user.get_full_name(),
                'scheduled_at': d['scheduled_at'].strftime('%d/%m/%Y %H:%M'),
            },
        )
        return Response({'detail': 'Médico despachado.', 'appointment_id': str(appointment.pk)})


class DismissAlertView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk, alert_id):
        link = get_active_link_for_caregiver(pk, request.user)
        if not link:
            return Response({'detail': 'Acceso no autorizado.'}, status=status.HTTP_403_FORBIDDEN)
        alert = CareAlert.objects.filter(pk=alert_id, care_link=link, status=CareAlert.Status.OPEN).first()
        if not alert:
            return Response({'detail': 'Alerta no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
        alert.status = CareAlert.Status.DISMISSED
        alert.dismissed_by = request.user
        alert.resolved_at = timezone.now()
        alert.save(update_fields=['status', 'dismissed_by', 'resolved_at'])
        return Response({'detail': 'Alerta descartada.'})


# ── Medication Payments ───────────────────────────────────────────────────────

class MedicationPaymentListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        link = get_active_link_for_caregiver(pk, request.user)
        if not link:
            return Response({'detail': 'Acceso no autorizado.'}, status=status.HTTP_403_FORBIDDEN)
        payments = link.medication_payments.all()
        return Response(MedicationPaymentSerializer(payments, many=True).data)

    def post(self, request, pk):
        link = get_active_link_for_caregiver(pk, request.user)
        if not link:
            return Response({'detail': 'Acceso no autorizado.'}, status=status.HTTP_403_FORBIDDEN)
        if not link.permissions.get('can_pay_meds'):
            return Response({'detail': 'Sin permiso para realizar pagos.'}, status=status.HTTP_403_FORBIDDEN)

        serializer = MedicationPaymentCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payment = serializer.save(care_link=link)

        from apps.notifications.service import notify
        notify(
            user=link.patient,
            code='FAMILY_PAYMENT_RECEIVED',
            context={'description': payment.description},
        )
        return Response(MedicationPaymentSerializer(payment).data, status=status.HTTP_201_CREATED)
