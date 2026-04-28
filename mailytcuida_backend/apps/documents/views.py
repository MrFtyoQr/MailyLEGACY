"""
Documents API views.

  GET  /api/v1/documents/                    — list patient documents (filterable by category)
  POST /api/v1/documents/                    — register document (after client-side R2 upload)
  GET  /api/v1/documents/<id>/               — detail
  PATCH /api/v1/documents/<id>/              — update title/description/category
  DELETE /api/v1/documents/<id>/             — soft-delete

  POST /api/v1/documents/upload-url/         — get presigned PUT URL for direct R2 upload

  POST /api/v1/documents/<id>/ocr/           — trigger OCR task (returns 202)

  GET  /api/v1/documents/<id>/shares/        — list active shares for this document
  POST /api/v1/documents/<id>/shares/        — share with a doctor
  DELETE /api/v1/documents/<id>/shares/<share_id>/ — revoke share

  POST /api/v1/documents/export/             — request PDF health summary (returns 202)
  GET  /api/v1/documents/exports/            — list past exports

  GET  /api/v1/documents/shared-with-me/     — doctor: list documents shared with them
"""
from django.utils import timezone
from django.shortcuts import get_object_or_404
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.accounts.models import PatientProfile, DoctorProfile, DoctorPatient
from .models import MedicalDocument, DocumentShare, HealthSummaryExport
from .serializers import (
    MedicalDocumentSerializer, MedicalDocumentCreateSerializer,
    DocumentShareSerializer, HealthSummaryExportSerializer, ExportRequestSerializer,
)


def _get_patient(request):
    return get_object_or_404(PatientProfile, user=request.user)


def _get_doctor(request):
    return get_object_or_404(DoctorProfile, user=request.user)


# ── Document list / create ─────────────────────────────────────────────────────

class DocumentListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated]

    def get_serializer_class(self):
        return MedicalDocumentCreateSerializer if self.request.method == 'POST' else MedicalDocumentSerializer

    def get_queryset(self):
        patient  = _get_patient(self.request)
        qs       = MedicalDocument.objects.filter(patient=patient, is_active=True)
        category = self.request.query_params.get('category')
        if category:
            qs = qs.filter(category=category)
        return qs

    def perform_create(self, serializer):
        patient  = _get_patient(self.request)
        doc      = serializer.save(patient=patient)
        # Trigger OCR asynchronously if it's an image or PDF
        mime     = doc.mime_type or ''
        if any(mime.startswith(t) for t in ('image/', 'application/pdf')):
            from .tasks import process_document_ocr
            process_document_ocr.delay(str(doc.id))


# ── Document detail / update / soft-delete ────────────────────────────────────

class DocumentDetailView(generics.RetrieveUpdateDestroyAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class   = MedicalDocumentSerializer
    http_method_names  = ['get', 'patch', 'delete']

    def get_object(self):
        patient = _get_patient(self.request)
        return get_object_or_404(MedicalDocument, pk=self.kwargs['pk'],
                                 patient=patient, is_active=True)

    def perform_destroy(self, instance):
        instance.is_active = False
        instance.save(update_fields=['is_active'])


# ── Presigned upload URL ───────────────────────────────────────────────────────

class PresignedUploadUrlView(APIView):
    """Returns a short-lived PUT URL the client uses to upload directly to R2."""
    permission_classes = [IsAuthenticated]

    def post(self, request):
        file_name = request.data.get('file_name', 'upload.bin')
        mime_type = request.data.get('mime_type', 'application/octet-stream')
        patient   = _get_patient(request)
        try:
            from .storage import generate_presigned_upload
            result = generate_presigned_upload(str(patient.id), file_name, mime_type)
            return Response(result, status=status.HTTP_200_OK)
        except Exception as exc:
            return Response({'detail': str(exc)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)


# ── OCR trigger ───────────────────────────────────────────────────────────────

class DocumentOCRView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        patient = _get_patient(request)
        doc     = get_object_or_404(MedicalDocument, pk=pk, patient=patient, is_active=True)
        from .tasks import process_document_ocr
        process_document_ocr.delay(str(doc.id))
        return Response({'detail': 'OCR task enqueued.'}, status=status.HTTP_202_ACCEPTED)


# ── Document sharing ──────────────────────────────────────────────────────────

class DocumentShareListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def _get_doc(self, request, pk):
        patient = _get_patient(request)
        return get_object_or_404(MedicalDocument, pk=pk, patient=patient, is_active=True)

    def get(self, request, pk):
        doc    = self._get_doc(request, pk)
        shares = DocumentShare.objects.filter(document=doc, is_active=True)
        return Response(DocumentShareSerializer(shares, many=True).data)

    def post(self, request, pk):
        doc       = self._get_doc(request, pk)
        doctor_id = request.data.get('doctor_id')
        if not doctor_id:
            return Response({'detail': 'doctor_id is required.'}, status=status.HTTP_400_BAD_REQUEST)

        patient = _get_patient(request)
        # Only allow sharing with assigned doctors
        if not DoctorPatient.objects.filter(
            doctor__id=doctor_id, patient=patient, is_active=True
        ).exists():
            return Response(
                {'detail': 'Solo puedes compartir con médicos asignados.'},
                status=status.HTTP_403_FORBIDDEN,
            )

        doctor = get_object_or_404(DoctorProfile, pk=doctor_id)
        share, created = DocumentShare.objects.get_or_create(
            document=doc, doctor=doctor,
            defaults={'is_active': True},
        )
        if not created and not share.is_active:
            share.is_active  = True
            share.revoked_at = None
            share.save(update_fields=['is_active', 'revoked_at'])

        return Response(DocumentShareSerializer(share).data,
                        status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)


class DocumentShareRevokeView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk, share_id):
        patient = _get_patient(request)
        doc     = get_object_or_404(MedicalDocument, pk=pk, patient=patient, is_active=True)
        share   = get_object_or_404(DocumentShare, pk=share_id, document=doc, is_active=True)
        share.is_active  = False
        share.revoked_at = timezone.now()
        share.save(update_fields=['is_active', 'revoked_at'])
        return Response(status=status.HTTP_204_NO_CONTENT)


# ── Doctor: documents shared with me ─────────────────────────────────────────

class SharedWithMeView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class   = MedicalDocumentSerializer

    def get_queryset(self):
        doctor = _get_doctor(self.request)
        doc_ids = DocumentShare.objects.filter(
            doctor=doctor, is_active=True
        ).values_list('document_id', flat=True)
        return MedicalDocument.objects.filter(id__in=doc_ids, is_active=True)


# ── PDF health summary export ─────────────────────────────────────────────────

class HealthSummaryExportRequestView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ser = ExportRequestSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        patient = _get_patient(request)

        export = HealthSummaryExport.objects.create(
            patient  = patient,
            sections = ser.validated_data['sections'],
        )
        from .tasks import generate_health_summary_pdf
        generate_health_summary_pdf.delay(str(export.id))

        return Response(
            HealthSummaryExportSerializer(export).data,
            status=status.HTTP_202_ACCEPTED,
        )


class HealthSummaryExportListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class   = HealthSummaryExportSerializer

    def get_queryset(self):
        patient = _get_patient(self.request)
        return HealthSummaryExport.objects.filter(patient=patient)
