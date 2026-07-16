"""
Signal receivers that automatically award points when key events occur.

Covered:
  MedicationHistory saved as TAKEN  → MEDICATION_TAKEN points
  VitalSign created                 → VITAL_LOGGED points
  LabResult created                 → LAB_UPLOADED points
  Appointment status → COMPLETED    → APPOINTMENT_KEPT points
  ReferralRequest status → COMPLETED → REFERRAL_COMPLETED points
"""
import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

logger = logging.getLogger(__name__)


@receiver(post_save, sender='medications.MedicationHistory')
def _on_medication_taken(sender, instance, created, **kwargs):
    """
    Otorga puntos cuando la dosis queda en TAKEN.

    El flujo normal crea la entrada como PENDING (tarea nocturna) y el paciente
    la marca tomada vía POST /history/<id>/take/ (update, created=False).
    award_points es idempotente por (player, source, ref_id).
    """
    if instance.status != 'TAKEN':
        return
    from .engine import award_points, PointSource
    award_points(
        patient = instance.patient,
        source  = PointSource.MEDICATION_TAKEN,
        ref_id  = str(instance.id),
    )


@receiver(post_save, sender='vitals.VitalSign')
def _on_vital_logged(sender, instance, created, **kwargs):
    if not created:
        return
    from .engine import award_points, PointSource
    base_pts = 10 if instance.photo_url else 5
    logger.info(
        'VitalSign %s created | type=%s | photo_url=%r | base_pts=%d',
        instance.id, instance.vital_type, instance.photo_url, base_pts,
    )
    award_points(
        patient     = instance.patient,
        source      = PointSource.VITAL_LOGGED,
        ref_id      = str(instance.id),
        base_points = base_pts,
        note        = 'con foto de evidencia' if instance.photo_url else '',
    )


@receiver(post_save, sender='lab_results.LabResult')
def _on_lab_uploaded(sender, instance, created, **kwargs):
    if not created:
        return
    from .engine import award_points, PointSource
    award_points(
        patient = instance.patient,
        source  = PointSource.LAB_UPLOADED,
        ref_id  = str(instance.id),
    )


@receiver(post_save, sender='appointments.Appointment')
def _on_appointment_completed(sender, instance, created, update_fields, **kwargs):
    if created:
        return
    if update_fields and 'status' not in update_fields:
        return
    if instance.status == 'COMPLETED':
        from .engine import award_points, PointSource
        award_points(
            patient = instance.patient,
            source  = PointSource.APPOINTMENT_KEPT,
            ref_id  = str(instance.id),
        )


@receiver(post_save, sender='specialists.ReferralRequest')
def _on_referral_completed(sender, instance, created, update_fields, **kwargs):
    if created:
        return
    if update_fields and 'status' not in update_fields:
        return
    if instance.status == 'COMPLETED':
        from .engine import award_points, PointSource
        award_points(
            patient = instance.patient,
            source  = PointSource.REFERRAL_COMPLETED,
            ref_id  = str(instance.id),
        )
