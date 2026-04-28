"""
Django signal receivers for automatic audit logging on key model events.

Covered:
  - MedicationHistory: TAKEN / SKIPPED actions
  - DocumentShare: DOCUMENT_SHARED / DOCUMENT_REVOKED
  - Subscription: PLAN_CHANGE
  - HealthSummaryExport: EXPORT_PDF (status → READY)
"""
from django.db.models.signals import post_save
from django.dispatch import receiver


# ── MedicationHistory ─────────────────────────────────────────────────────────

@receiver(post_save, sender='medications.MedicationHistory')
def _audit_medication_history(sender, instance, created, **kwargs):
    if not created:
        return
    from .logger import audit, AuditAction, ResourceType
    action_map = {
        'TAKEN':     AuditAction.MEDICATION_TAKEN,
        'SKIPPED':   AuditAction.MEDICATION_SKIPPED,
    }
    action = action_map.get(instance.status)
    if action:
        audit(
            actor         = instance.patient.user,
            action        = action,
            resource_type = ResourceType.MEDICATION_HISTORY,
            resource_id   = str(instance.id),
            patient       = instance.patient,
            note          = f'medication={instance.medication_name}',
        )


# ── DocumentShare ─────────────────────────────────────────────────────────────

@receiver(post_save, sender='documents.DocumentShare')
def _audit_document_share(sender, instance, created, update_fields, **kwargs):
    from .logger import audit, AuditAction, ResourceType

    if created and instance.is_active:
        audit(
            actor         = instance.document.patient.user,
            action        = AuditAction.DOCUMENT_SHARED,
            resource_type = ResourceType.DOCUMENT,
            resource_id   = str(instance.document.id),
            patient       = instance.document.patient,
            note          = f'shared_with_doctor={instance.doctor_id}',
        )
    elif update_fields and 'is_active' in update_fields and not instance.is_active:
        audit(
            actor         = instance.document.patient.user,
            action        = AuditAction.DOCUMENT_REVOKED,
            resource_type = ResourceType.DOCUMENT,
            resource_id   = str(instance.document.id),
            patient       = instance.document.patient,
            note          = f'revoked_from_doctor={instance.doctor_id}',
        )


# ── Subscription / Plan change ────────────────────────────────────────────────

@receiver(post_save, sender='payments.Subscription')
def _audit_subscription(sender, instance, created, update_fields, **kwargs):
    from .logger import audit, AuditAction, ResourceType

    if update_fields and 'plan_id' in update_fields:
        audit(
            actor         = instance.user,
            action        = AuditAction.PLAN_CHANGE,
            resource_type = ResourceType.SUBSCRIPTION,
            resource_id   = str(instance.id),
            note          = f'new_plan={instance.plan.tier if instance.plan else "none"}',
        )


# ── HealthSummaryExport ───────────────────────────────────────────────────────

@receiver(post_save, sender='documents.HealthSummaryExport')
def _audit_pdf_export(sender, instance, created, update_fields, **kwargs):
    if not created:
        return
    from .logger import audit, AuditAction, ResourceType
    audit(
        actor         = instance.patient.user,
        action        = AuditAction.EXPORT_PDF,
        resource_type = ResourceType.EXPORT,
        resource_id   = str(instance.id),
        patient       = instance.patient,
        note          = f'sections={instance.sections}',
    )
