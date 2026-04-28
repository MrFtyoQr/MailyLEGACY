"""
Celery tasks for the Documents module.

  generate_health_summary_pdf(export_id)  — build PDF and store in R2
  process_document_ocr(document_id)       — (stub) OCR pipeline
"""
import logging
from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=2, default_retry_delay=60)
def generate_health_summary_pdf(self, export_id: str):
    """
    Build a PDF health summary and upload it to R2.
    Updates HealthSummaryExport.status → READY | FAILED.
    """
    from django.utils import timezone
    from .models import HealthSummaryExport, DocumentStatus
    from .pdf_builder import build_health_summary_pdf
    from .storage import _s3_client
    from django.conf import settings
    import uuid, io

    try:
        export = HealthSummaryExport.objects.select_related(
            'patient__user'
        ).get(pk=export_id)
    except HealthSummaryExport.DoesNotExist:
        logger.error('HealthSummaryExport %s not found', export_id)
        return

    export.status = DocumentStatus.PROCESSING
    export.save(update_fields=['status'])

    try:
        pdf_bytes = build_health_summary_pdf(export.patient, export.sections)

        # Upload to R2 / S3
        key    = f'patients/{export.patient.id}/exports/{uuid.uuid4()}.pdf'
        bucket = settings.AWS_STORAGE_BUCKET_NAME
        client = _s3_client()
        client.put_object(
            Bucket=bucket, Key=key,
            Body=pdf_bytes, ContentType='application/pdf',
        )
        endpoint = settings.AWS_S3_ENDPOINT_URL.rstrip('/')
        pdf_url  = f'{endpoint}/{bucket}/{key}' if endpoint else f'https://{bucket}.s3.amazonaws.com/{key}'

        export.pdf_url      = pdf_url
        export.status       = DocumentStatus.READY
        export.completed_at = timezone.now()
        export.save(update_fields=['pdf_url', 'status', 'completed_at'])
        logger.info('PDF export %s ready: %s', export_id, pdf_url)

    except Exception as exc:
        logger.error('generate_health_summary_pdf failed for export %s: %s', export_id, exc)
        export.status = DocumentStatus.FAILED
        export.error  = str(exc)
        export.save(update_fields=['status', 'error'])
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=1)
def process_document_ocr(self, document_id: str):
    """
    OCR pipeline stub.
    In production: send file_url to Google Vision / AWS Textract,
    parse the structured data, write back to ocr_text + ocr_data.
    If the document is a lab report, optionally create LabResult records.
    """
    from .models import MedicalDocument, DocumentStatus, DocumentCategory

    try:
        doc = MedicalDocument.objects.get(pk=document_id)
    except MedicalDocument.DoesNotExist:
        return

    doc.status = DocumentStatus.PROCESSING
    doc.save(update_fields=['status'])

    try:
        # ── TODO: replace stub with real OCR call ─────────────────────────
        # Example:
        #   text, structured = ocr_provider.process(doc.file_url, doc.mime_type)
        #   doc.ocr_text = text
        #   doc.ocr_data = structured
        #   if doc.category == DocumentCategory.LAB_RESULT:
        #       _create_lab_results_from_ocr(doc.patient, structured)
        # ─────────────────────────────────────────────────────────────────
        doc.status = DocumentStatus.READY
        doc.save(update_fields=['status', 'ocr_text', 'ocr_data'])
        logger.info('OCR stub completed for document %s', document_id)

    except Exception as exc:
        logger.error('process_document_ocr failed for %s: %s', document_id, exc)
        doc.status = DocumentStatus.FAILED
        doc.save(update_fields=['status'])
        raise self.retry(exc=exc)
