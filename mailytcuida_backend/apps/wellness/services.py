"""
Wellness services — shared logic used by views and signals.

upsert_daily_checkin: called after every MoodEntry or SleepEntry save
                      to keep DailyCheckin in sync.

complete_activity: marks an activity done, awards gamification points,
                   checks if the full program is complete.
"""
import logging
from datetime import date as date_type

from django.utils import timezone

_log = logging.getLogger(__name__)


def upsert_daily_checkin(patient, entry_date: date_type):
    """Refresh or create DailyCheckin for patient on entry_date."""
    from .models import DailyCheckin, MoodEntry, SleepEntry

    # Latest mood of the day
    mood = (
        MoodEntry.objects
        .filter(patient=patient, logged_at__date=entry_date)
        .order_by('-logged_at')
        .first()
    )
    # Sleep entry for that date
    sleep = SleepEntry.objects.filter(patient=patient, sleep_date=entry_date).first()

    # Count activities completed that day via enrollment completions
    from .models import ActivityCompletion
    acts_done = ActivityCompletion.objects.filter(
        enrollment__patient=patient,
        completed_at__date=entry_date,
    ).count()

    DailyCheckin.objects.update_or_create(
        patient=patient,
        date=entry_date,
        defaults={
            'mood_score': mood.score if mood else None,
            'mood_label': mood.label if mood else '',
            'sleep_hours': sleep.duration_hours if sleep else None,
            'sleep_quality': sleep.quality if sleep else '',
            'activities_completed': acts_done,
        },
    )


def complete_activity(enrollment, activity, note=''):
    """
    Mark activity as done, award points, check program completion.
    Returns ActivityCompletion (or existing one if already done).
    """
    from .models import ActivityCompletion, ProgramEnrollment

    completion, created = ActivityCompletion.objects.get_or_create(
        enrollment=enrollment,
        activity=activity,
        defaults={'note': note},
    )
    if not created:
        return completion  # already done — idempotent

    # Award gamification points if defined
    if activity.points_reward > 0:
        try:
            from apps.gamification.engine import award_points
            award_points(
                patient=enrollment.patient,
                source='MANUAL_ADJUSTMENT',
                ref_id=str(completion.id),
                base_points=activity.points_reward,
                note=f'Wellness activity: {activity.title}',
            )
        except Exception as exc:
            _log.warning('Gamification award failed for activity %s: %s', activity.id, exc)

    # Check if all activities are now complete
    total = enrollment.program.activities.count()
    done = enrollment.completions.count()
    if total > 0 and done >= total:
        enrollment.status = ProgramEnrollment.Status.COMPLETED
        enrollment.completed_at = timezone.now()
        enrollment.save(update_fields=['status', 'completed_at'])

        # Notify patient
        try:
            from apps.notifications.service import notify
            notify(
                user=enrollment.patient.user,
                code='WELLNESS_PROGRAM_COMPLETED',
                channel='IN_APP',
                extra_data={'program_title': enrollment.program.title},
            )
        except Exception as exc:
            _log.warning('Notify wellness complete failed: %s', exc)

    # Refresh daily check-in
    try:
        upsert_daily_checkin(enrollment.patient, entry_date=completion.completed_at.date())
    except Exception as exc:
        _log.warning('upsert_daily_checkin failed: %s', exc)

    return completion
