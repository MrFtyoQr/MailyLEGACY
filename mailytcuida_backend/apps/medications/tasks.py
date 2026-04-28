from celery import shared_task
from django.utils import timezone
from datetime import timedelta
import logging

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_medication_reminder(self, history_id: str):
    """Send push/email reminder 15 min before a scheduled dose."""
    from .models import MedicationHistory
    try:
        entry = MedicationHistory.objects.select_related(
            'patient__user', 'medication'
        ).get(pk=history_id, status=MedicationHistory.Status.PENDING)
    except MedicationHistory.DoesNotExist:
        return

    from apps.notifications.service import notify
    notify(
        user=entry.patient.user,
        code='MEDICATION_REMINDER',
        context={
            'medication_name': entry.medication_name,
            'dosage': entry.medication.dosage,
            'unit':   entry.medication.unit,
        },
        channel='PUSH',
        data={'screen': 'history', 'id': str(entry.pk)},
    )
    entry.reminder_sent_at = timezone.now()
    entry.save(update_fields=['reminder_sent_at'])


@shared_task
def generate_daily_history_entries():
    """
    Runs at midnight. Creates PENDING MedicationHistory entries for every
    active schedule whose pattern is active today.
    """
    from .models import Medication, MedicationSchedule, MedicationHistory
    from django.utils import timezone as tz
    today = tz.localdate()
    now   = tz.now()
    created = 0

    for schedule in MedicationSchedule.objects.filter(is_active=True).select_related(
        'medication__patient', 'pattern'
    ):
        med = schedule.medication
        if not med.is_active:
            continue
        if not _schedule_active_today(schedule, today):
            continue

        scheduled_dt = tz.make_aware(
            timezone.datetime.combine(today, schedule.time)
        )
        _, is_new = MedicationHistory.objects.get_or_create(
            patient=med.patient,
            medication=med,
            schedule=schedule,
            scheduled_at=scheduled_dt,
            defaults={
                'medication_name': med.name,
                'status': MedicationHistory.Status.PENDING,
            },
        )
        if is_new:
            created += 1
            # Schedule reminder task
            reminder_at = scheduled_dt - timedelta(minutes=schedule.reminder_minutes_before)
            if reminder_at > now:
                pass  # TODO: send_medication_reminder.apply_async(eta=reminder_at)

    logger.info('generate_daily_history_entries: created %d entries for %s', created, today)
    return created


@shared_task
def check_medication_adherence():
    """
    Runs every hour. Detects patients with adherence < 70% in the last 7 days
    and triggers alert_doctor_low_adherence for their assigned doctors.
    """
    from .models import MedicationHistory
    from apps.accounts.models import DoctorPatient
    from django.db.models import Count, Q

    seven_days_ago = timezone.now() - timedelta(days=7)

    patients_stats = (
        MedicationHistory.objects
        .filter(scheduled_at__gte=seven_days_ago)
        .values('patient')
        .annotate(
            total=Count('id'),
            taken=Count('id', filter=Q(status=MedicationHistory.Status.TAKEN)),
        )
    )

    for stat in patients_stats:
        if stat['total'] == 0:
            continue
        adherence = stat['taken'] / stat['total']
        if adherence < 0.70:
            patient_id = stat['patient']
            doctor_ids = DoctorPatient.objects.filter(
                patient_id=patient_id, is_active=True
            ).values_list('doctor_id', flat=True)
            for doctor_id in doctor_ids:
                alert_doctor_low_adherence.delay(str(patient_id), str(doctor_id), round(adherence * 100, 1))


@shared_task
def alert_doctor_low_adherence(patient_id: str, doctor_id: str, adherence_pct: float):
    """Notifies a doctor when a patient's 7-day medication adherence drops below 70%."""
    # TODO: dispatch in-app / email notification via M11 Notifications
    logger.warning(
        'Low adherence alert: doctor=%s patient=%s adherence=%.1f%%',
        doctor_id, patient_id, adherence_pct,
    )


# ── helpers ──────────────────────────────────────────────────────────────────

def _schedule_active_today(schedule, today) -> bool:
    from .models import MedicationPattern
    pattern = schedule.pattern
    if pattern is None or not pattern.is_active:
        return True  # no pattern restriction → always active

    pt = pattern.pattern_type
    if pt == MedicationPattern.PatternType.DAILY:
        return True
    if pt == MedicationPattern.PatternType.WEEKLY:
        return today.weekday() == 0  # every Monday; adjust per business rule
    if pt == MedicationPattern.PatternType.SPECIFIC_DAYS:
        return today.weekday() in (pattern.specific_days_of_week or [])
    if pt == MedicationPattern.PatternType.CUSTOM:
        every = pattern.repeat_every_days
        if not every:
            return True
        delta = (today - pattern.created_at.date()).days
        return delta % every == 0
    return True
