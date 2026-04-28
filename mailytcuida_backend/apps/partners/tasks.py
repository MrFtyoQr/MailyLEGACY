"""
Celery tasks for Partner Portal.

  compute_partner_snapshots()  — weekly; builds PartnerHealthSnapshot for
                                 every active organization.
"""
import logging
from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task
def compute_partner_snapshots():
    """
    Run every Monday. Computes the previous week's aggregated health metrics
    for each active PartnerOrganization and stores a PartnerHealthSnapshot.

    Privacy: only counts members with consent=True.
    Suppression: cohorts < 10 members are stored but marked as suppressed.
    """
    from datetime import date, timedelta
    from django.db.models import Avg
    from .models import PartnerOrganization, MemberEnrollment, PartnerHealthSnapshot, PartnerStatus

    today      = date.today()
    week_end   = today - timedelta(days=1)
    week_start = week_end - timedelta(days=6)

    orgs = PartnerOrganization.objects.filter(status=PartnerStatus.ACTIVE)
    created = 0

    for org in orgs:
        try:
            enrollments = MemberEnrollment.objects.filter(
                organization=org, is_active=True, consent=True
            ).select_related('patient')

            consenting = enrollments.count()
            patient_ids = list(enrollments.values_list('patient_id', flat=True))

            if not patient_ids:
                continue

            # Adherence
            from apps.analytics.engine import calculate_adherence
            from apps.accounts.models import PatientProfile

            total_adherence = 0
            low_adherence   = 0
            active_count    = 0

            for pid in patient_ids:
                try:
                    patient = PatientProfile.objects.get(pk=pid)
                    stats   = calculate_adherence(patient, days=7)
                    if stats['total'] > 0:
                        active_count += 1
                        total_adherence += stats['adherence_pct']
                        if stats['adherence_pct'] < 70:
                            low_adherence += 1
                except Exception:
                    continue

            avg_adh = round(total_adherence / active_count, 2) if active_count else 0

            # Avg vitals (last 7 days, group level)
            from apps.vitals.models import VitalSign
            from django.utils import timezone
            cutoff = timezone.now() - timedelta(days=7)
            avg_vitals = {}
            for vtype in ['GLUCOSE', 'WEIGHT', 'BLOOD_PRESSURE', 'HEART_RATE']:
                qs = VitalSign.objects.filter(
                    patient_id__in=patient_ids,
                    vital_type=vtype,
                    recorded_at__gte=cutoff,
                )
                agg = qs.aggregate(avg=Avg('value'))['avg']
                if agg is not None:
                    avg_vitals[vtype] = round(float(agg), 1)

            PartnerHealthSnapshot.objects.update_or_create(
                organization=org,
                period_start=week_start,
                defaults={
                    'period_end':          week_end,
                    'consenting_members':  consenting,
                    'active_members':      active_count,
                    'avg_adherence_pct':   avg_adh,
                    'low_adherence_count': low_adherence,
                    'avg_vitals':          avg_vitals,
                },
            )
            created += 1
            logger.info('Snapshot computed for org=%s (%d consenting)', org.name, consenting)

        except Exception as exc:
            logger.error('compute_partner_snapshots failed for org=%s: %s', org.id, exc)

    logger.info('Partner snapshots done: %d orgs processed', created)
    return created
