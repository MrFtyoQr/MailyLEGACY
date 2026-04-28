"""
Analytics computation engine.
Pure functions — no side effects, no DB writes.
"""
from datetime import date, timedelta
from decimal import Decimal


def calculate_adherence(patient, days: int = 7) -> dict:
    """
    Returns adherence stats for the last `days` days.
    {
        total, taken, skipped, postponed, pending,
        adherence_pct,
        per_medication: [{name, total, taken, pct}]
    }
    """
    from apps.medications.models import MedicationHistory

    since = date.today() - timedelta(days=days)
    qs = MedicationHistory.objects.filter(
        patient=patient,
        scheduled_at__date__gte=since,
    ).select_related('medication')

    total     = qs.count()
    taken     = qs.filter(status='TAKEN').count()
    skipped   = qs.filter(status='SKIPPED').count()
    postponed = qs.filter(status='POSTPONED').count()
    pending   = qs.filter(status='PENDING').count()

    adherence_pct = Decimal(taken / total * 100).quantize(Decimal('0.01')) if total else Decimal('0')

    # Per-medication breakdown
    med_ids = qs.values_list('medication_id', flat=True).distinct()
    per_med = []
    for med_id in med_ids:
        med_qs  = qs.filter(medication_id=med_id)
        m_total = med_qs.count()
        m_taken = med_qs.filter(status='TAKEN').count()
        m_name  = med_qs.first().medication_name
        per_med.append({
            'name':  m_name,
            'total': m_total,
            'taken': m_taken,
            'pct':   round(m_taken / m_total * 100, 1) if m_total else 0,
        })

    return {
        'days':          days,
        'total':         total,
        'taken':         taken,
        'skipped':       skipped,
        'postponed':     postponed,
        'pending':       pending,
        'adherence_pct': float(adherence_pct),
        'per_medication': per_med,
    }


def build_health_context(patient) -> dict:
    """
    Assembles a structured health context for AI prompt injection.
    Uses only numeric/categorical data — no PII names.
    """
    from apps.vitals.models import VitalSign
    from apps.lab_results.models import LabResult
    from apps.medications.models import MedicationHistory

    today = date.today()
    since_30 = today - timedelta(days=30)
    since_90 = today - timedelta(days=90)

    # ── Adherence (last 7 days) ───────────────────────────────────────────────
    adherence = calculate_adherence(patient, days=7)

    # ── Vitals (last 30 days) ─────────────────────────────────────────────────
    vitals_raw = (
        VitalSign.objects
        .filter(patient=patient, recorded_at__date__gte=since_30)
        .order_by('vital_type', '-recorded_at')
    )
    vitals_summary = {}
    for v in vitals_raw:
        if v.vital_type not in vitals_summary:
            vitals_summary[v.vital_type] = {
                'latest': float(v.value),
                'unit': v.unit,
                'readings': [],
            }
        vitals_summary[v.vital_type]['readings'].append(float(v.value))

    # Compute simple trend per vital type
    for vtype, data in vitals_summary.items():
        readings = data['readings']
        if len(readings) >= 2:
            data['trend'] = 'up' if readings[0] > readings[-1] else (
                'down' if readings[0] < readings[-1] else 'stable'
            )
        else:
            data['trend'] = 'insufficient_data'
        del data['readings']  # don't send raw arrays to LLM

    # ── Lab results (last 90 days, abnormal only) ─────────────────────────────
    abnormal_labs = list(
        LabResult.objects
        .filter(
            patient=patient,
            performed_at__gte=since_90,
            status__in=['ABNORMAL_LOW', 'ABNORMAL_HIGH', 'CRITICAL'],
        )
        .values('parameter', 'value', 'unit', 'status', 'ref_min', 'ref_max')
        .order_by('parameter')
    )

    # ── Upcoming medications ──────────────────────────────────────────────────
    active_meds = list(
        patient.medications
        .filter(is_active=True)
        .values('name', 'dosage', 'unit')
    )

    return {
        'adherence':   adherence,
        'vitals':      vitals_summary,
        'abnormal_labs': abnormal_labs,
        'active_meds': active_meds,
        'as_of':       today.isoformat(),
    }


def get_patient_tier(patient) -> str:
    """Returns the subscription tier for a patient, defaulting to FREE."""
    try:
        return patient.user.subscription.plan.tier
    except Exception:
        return 'FREE'
