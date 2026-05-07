from django.db.models.signals import post_save
from django.dispatch import receiver


@receiver(post_save, sender='vitals.VitalSign')
def on_vital_sign_saved(sender, instance, created, **kwargs):
    if not created:
        return
    _sync_monitor_configs(instance)
    _check_and_alert(instance)


def _sync_monitor_configs(vital):
    from .models import VitalMonitorConfig
    # FamilyCareLink.patient is a User FK; VitalSign.patient is PatientProfile FK
    VitalMonitorConfig.objects.filter(
        care_link__patient=vital.patient.user,
        care_link__status='ACTIVE',
        vital_type=vital.vital_type,
        is_active=True,
    ).update(last_patient_reading_at=vital.recorded_at)


def _check_and_alert(vital):
    from .models import FamilyCareLink
    from apps.vitals.models import VitalGoal

    goal = VitalGoal.objects.filter(
        patient=vital.patient, vital_type=vital.vital_type
    ).first()
    if not goal:
        return

    is_abnormal = False
    severity = 'HIGH'
    if goal.min_value is not None and vital.value < float(goal.min_value):
        is_abnormal = True
        diff_pct = (float(goal.min_value) - vital.value) / float(goal.min_value) * 100
        severity = 'CRITICAL' if diff_pct > 20 else 'HIGH'
    elif goal.max_value is not None and vital.value > float(goal.max_value):
        is_abnormal = True
        diff_pct = (vital.value - float(goal.max_value)) / float(goal.max_value) * 100
        severity = 'CRITICAL' if diff_pct > 20 else 'HIGH'

    if not is_abnormal:
        return

    links = FamilyCareLink.objects.filter(
        patient=vital.patient.user,
        status='ACTIVE',
    ).select_related('caregiver')

    from .tasks import notify_caregiver_vital_abnormal
    for link in links:
        notify_caregiver_vital_abnormal.delay(str(link.pk), str(vital.pk), severity)
