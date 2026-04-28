"""
Signal receivers that automatically award points when key events occur.

Covered:
  MedicationHistory saved as TAKEN  → MEDICATION_TAKEN points
  VitalSign created                 → VITAL_LOGGED points
  LabResult created                 → LAB_UPLOADED points
  Appointment status → COMPLETED    → APPOINTMENT_KEPT points
  ReferralRequest status → COMPLETED → REFERRAL_COMPLETED points
"""
from django.db.models.signals import post_save
from django.dispatch import receiver


@receiver(post_save, sender='medications.MedicationHistory')
def _on_medication_taken(sender, instance, created, **kwargs):
    if not created or instance.status != 'TAKEN':
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
    award_points(
        patient = instance.patient,
        source  = PointSource.VITAL_LOGGED,
        ref_id  = str(instance.id),
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
