"""
Prescriptions API.

Patient-facing (auth required):
  GET    /api/v1/prescriptions/                — list patient prescriptions
  POST   /api/v1/prescriptions/                — manual upload (photo/PDF)
  GET    /api/v1/prescriptions/<id>/           — detail
  PATCH  /api/v1/prescriptions/<id>/           — annotate (title, notes, status)
  DELETE /api/v1/prescriptions/<id>/           — soft delete

Public (no auth):
  GET    /api/v1/prescriptions/verify/<token>/ — QR scan verification endpoint

MailySoft webhook (HMAC-signed, no Clerk auth):
  POST   /api/v1/prescriptions/webhook/receive/ — receive digitally-issued prescription
  POST   /api/v1/prescriptions/webhook/revoke/  — MailySoft revokes a prescription
"""
import logging
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny

from apps.accounts.models import PatientProfile, User
from .models import Prescription, PrescriptionVerification, PrescriptionSource, PrescriptionStatus
from .serializers import (
    PrescriptionSerializer, PrescriptionCreateSerializer,
    PrescriptionUpdateSerializer, PrescriptionWebhookPayload,
    PublicVerificationSerializer,
)
from .webhook import verify_mailysoft_signature, WebhookSignatureError

logger = logging.getLogger(__name__)


def _get_patient(request):
    return get_object_or_404(PatientProfile, user=request.user)


# ── Patient: list & manual upload ─────────────────────────────────────────────

class PrescriptionListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        return PrescriptionCreateSerializer if self.request.method == 'POST' else PrescriptionSerializer

    def get_queryset(self):
        patient = _get_patient(self.request)
        qs = Prescription.objects.filter(patient=patient, is_active=True)

        source = self.request.query_params.get('source')
        status_filter = self.request.query_params.get('status')
        if source:
            qs = qs.filter(source=source)
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs

    def perform_create(self, serializer):
        patient = _get_patient(self.request)
        serializer.save(patient=patient, source=PrescriptionSource.MANUAL)


# ── Patient: detail, annotate, soft-delete ────────────────────────────────────

class PrescriptionDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    http_method_names  = ['get', 'patch', 'delete']

    def get_serializer_class(self):
        return PrescriptionUpdateSerializer if self.request.method == 'PATCH' else PrescriptionSerializer

    def get_object(self):
        patient = _get_patient(self.request)
        return get_object_or_404(
            Prescription.objects.select_related('verification'),
            pk=self.kwargs['pk'], patient=patient, is_active=True,
        )

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=['is_active'])


# ── Public QR verification ────────────────────────────────────────────────────

class PrescriptionVerifyView(APIView):
    """
    Public endpoint — no authentication required.
    Called when someone scans the QR code on a prescription.
    Returns enough data for a pharmacist / doctor to confirm authenticity.
    """
    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, token):
        verification = get_object_or_404(PrescriptionVerification, token=token)
        return Response(PublicVerificationSerializer(verification).data)


# ── MailySoft webhooks ────────────────────────────────────────────────────────

class MailySoftReceiveView(APIView):
    """
    POST /api/v1/prescriptions/webhook/receive/

    MailySoft calls this when a doctor digitally issues a prescription to
    a patient.  The request is HMAC-signed; no Clerk JWT is required.
    """
    authentication_classes = []
    permission_classes     = [AllowAny]

    def post(self, request):
        # ── Signature verification ─────────────────────────────────────────
        sig_header = request.META.get('HTTP_X_MAILYSOFT_SIGNATURE', '')
        try:
            verify_mailysoft_signature(request.body, sig_header)
        except WebhookSignatureError as exc:
            logger.warning('MailySoft webhook signature failed: %s', exc)
            return Response({'detail': str(exc)}, status=status.HTTP_401_UNAUTHORIZED)

        # ── Payload validation ─────────────────────────────────────────────
        ser = PrescriptionWebhookPayload(data=request.data)
        if not ser.is_valid():
            return Response(ser.errors, status=status.HTTP_400_BAD_REQUEST)

        data = ser.validated_data

        # ── Idempotency — skip if already received ─────────────────────────
        mailysoft_id = data['mailysoft_prescription_id']
        if Prescription.objects.filter(mailysoft_id=mailysoft_id).exists():
            logger.info('MailySoft webhook duplicate: %s', mailysoft_id)
            return Response({'detail': 'already_processed'}, status=status.HTTP_200_OK)

        # ── Locate patient ─────────────────────────────────────────────────
        try:
            user    = User.objects.get(clerk_id=data['patient_clerk_id'])
            patient = PatientProfile.objects.get(user=user)
        except (User.DoesNotExist, PatientProfile.DoesNotExist):
            logger.warning(
                'MailySoft webhook: patient not found (clerk_id=%s)',
                data['patient_clerk_id'],
            )
            return Response(
                {'detail': 'patient_not_found'},
                status=status.HTTP_404_NOT_FOUND,
            )

        # ── Create prescription ────────────────────────────────────────────
        prescription = Prescription.objects.create(
            patient             = patient,
            source              = PrescriptionSource.MAILYSOFT,
            mailysoft_id        = mailysoft_id,
            mailysoft_doctor_id = data['mailysoft_doctor_id'],
            mailysoft_clinic_id = data.get('mailysoft_clinic_id', ''),
            prescribed_by       = data['doctor_name'],
            clinic_name         = data.get('clinic_name', ''),
            prescribed_at       = data['prescribed_at'],
            expires_at          = data.get('expires_at'),
            file_url            = data.get('file_url', ''),
            thumbnail_url       = data.get('thumbnail_url', ''),
            medications_listed  = data.get('medications', []),
            notes               = data.get('notes', ''),
            status              = PrescriptionStatus.ACTIVE,
        )

        # ── Create verification record ─────────────────────────────────────
        token = data['verification_token']
        base_url = request.build_absolute_uri(f'/api/v1/prescriptions/verify/{token}/')
        PrescriptionVerification.objects.create(
            prescription      = prescription,
            token             = token,
            verification_url  = data.get('verification_url') or base_url,
            issued_by_name    = data['doctor_name'],
            issued_by_license = data.get('doctor_license', ''),
            clinic_name       = data.get('clinic_name', ''),
            signature         = data.get('signature', ''),
            is_valid          = True,
        )

        # ── Notify patient ─────────────────────────────────────────────────
        try:
            from apps.notifications.service import notify
            notify(
                user    = user,
                code    = 'PRESCRIPTION_RECEIVED',
                context = {
                    'doctor_name': data['doctor_name'],
                    'clinic_name': data.get('clinic_name', ''),
                },
                channel = 'PUSH',
            )
        except Exception:
            pass  # notification failure must not roll back the prescription

        logger.info(
            'MailySoft prescription received: id=%s patient=%s',
            mailysoft_id, patient.id,
        )
        return Response(
            PrescriptionSerializer(prescription).data,
            status=status.HTTP_201_CREATED,
        )


class MailySoftRevokeView(APIView):
    """
    POST /api/v1/prescriptions/webhook/revoke/

    MailySoft calls this to invalidate a previously-issued prescription
    (e.g., the doctor cancelled it or it was issued by mistake).
    """
    authentication_classes = []
    permission_classes     = [AllowAny]

    def post(self, request):
        sig_header = request.META.get('HTTP_X_MAILYSOFT_SIGNATURE', '')
        try:
            verify_mailysoft_signature(request.body, sig_header)
        except WebhookSignatureError as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_401_UNAUTHORIZED)

        mailysoft_id = request.data.get('mailysoft_prescription_id')
        if not mailysoft_id:
            return Response(
                {'detail': 'mailysoft_prescription_id is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            prescription = Prescription.objects.get(mailysoft_id=mailysoft_id)
        except Prescription.DoesNotExist:
            return Response({'detail': 'not_found'}, status=status.HTTP_404_NOT_FOUND)

        prescription.status = PrescriptionStatus.EXPIRED
        prescription.save(update_fields=['status'])

        if hasattr(prescription, 'verification'):
            prescription.verification.is_valid    = False
            prescription.verification.invalidated_at = timezone.now()
            prescription.verification.save(update_fields=['is_valid', 'invalidated_at'])

        logger.info('MailySoft prescription revoked: %s', mailysoft_id)
        return Response({'detail': 'revoked'}, status=status.HTTP_200_OK)
