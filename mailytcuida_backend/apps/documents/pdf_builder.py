"""
PDF health-summary generator.

Produces a multi-section PDF report using ReportLab.
Sections are chosen by the caller: medications, vitals, labs,
appointments, insights.

If ReportLab is not installed, raises ImportError with a clear message
so the Celery task can set the export status to FAILED gracefully.
"""
import io
from datetime import date
from django.utils import timezone


def _require_reportlab():
    try:
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.lib.pagesizes import LETTER
        from reportlab.lib import colors
        from reportlab.lib.units import cm
        return SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, getSampleStyleSheet, LETTER, colors, cm
    except ImportError:
        raise ImportError(
            'ReportLab is required for PDF export. '
            'Install it with: pip install reportlab'
        )


def build_health_summary_pdf(patient, sections: list) -> bytes:
    """
    Build and return the raw PDF bytes for the patient health summary.
    `sections` is a list of section keys to include.
    """
    (SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
     getSampleStyleSheet, LETTER, colors, cm) = _require_reportlab()

    buf    = io.BytesIO()
    doc    = SimpleDocTemplate(buf, pagesize=LETTER,
                               rightMargin=2*cm, leftMargin=2*cm,
                               topMargin=2*cm, bottomMargin=2*cm)
    styles = getSampleStyleSheet()
    story  = []

    # ── Cover ─────────────────────────────────────────────────────────────
    story.append(Paragraph('Resumen de Salud — MailyT Cuida', styles['Title']))
    story.append(Paragraph(
        f'Paciente: {patient.first_name} {patient.last_name}', styles['Normal']
    ))
    story.append(Paragraph(f'Generado: {date.today():%d/%m/%Y}', styles['Normal']))
    story.append(Spacer(1, 0.5*cm))

    section_builders = {
        'medications':   _section_medications,
        'vitals':        _section_vitals,
        'labs':          _section_labs,
        'appointments':  _section_appointments,
        'insights':      _section_insights,
    }

    for key in sections:
        builder = section_builders.get(key)
        if builder:
            story.extend(builder(patient, styles, Paragraph, Spacer, Table, TableStyle, colors, cm))

    doc.build(story)
    return buf.getvalue()


# ── Section builders ──────────────────────────────────────────────────────────

def _section_medications(patient, styles, P, S, T, TS, colors, cm):
    from apps.medications.models import Medication
    meds = Medication.objects.filter(patient=patient, is_active=True)
    rows = [['Medicamento', 'Dosis', 'Frecuencia', 'Notas']]
    for m in meds:
        rows.append([m.name, m.dose or '—', m.frequency or '—', m.notes or '—'])
    return _table_section('Medicamentos activos', rows, styles, P, S, T, TS, colors, cm)


def _section_vitals(patient, styles, P, S, T, TS, colors, cm):
    from apps.vitals.models import VitalSign
    from django.utils import timezone
    cutoff = timezone.now() - __import__('datetime').timedelta(days=30)
    vitals = VitalSign.objects.filter(patient=patient, recorded_at__gte=cutoff).order_by('-recorded_at')[:50]
    rows = [['Tipo', 'Valor', 'Unidad', 'Fecha']]
    for v in vitals:
        val = str(v.value)
        if v.secondary_value:
            val += f'/{v.secondary_value}'
        rows.append([v.get_vital_type_display(), val, v.unit or '—', f'{v.recorded_at:%d/%m/%Y}'])
    return _table_section('Signos vitales (últimos 30 días)', rows, styles, P, S, T, TS, colors, cm)


def _section_labs(patient, styles, P, S, T, TS, colors, cm):
    from apps.lab_results.models import LabResult
    from django.utils import timezone
    cutoff = timezone.now() - __import__('datetime').timedelta(days=90)
    labs = LabResult.objects.filter(patient=patient, performed_at__gte=cutoff).order_by('-performed_at')[:60]
    rows = [['Parámetro', 'Valor', 'Unidad', 'Estado', 'Fecha']]
    for lab in labs:
        rows.append([
            lab.parameter_name,
            str(lab.value),
            lab.unit or '—',
            lab.get_status_display(),
            f'{lab.performed_at:%d/%m/%Y}',
        ])
    return _table_section('Resultados de laboratorio (últimos 90 días)', rows, styles, P, S, T, TS, colors, cm)


def _section_appointments(patient, styles, P, S, T, TS, colors, cm):
    from apps.appointments.models import Appointment
    appts = Appointment.objects.filter(patient=patient).order_by('-scheduled_at')[:20]
    rows = [['Fecha', 'Doctor', 'Tipo', 'Estado']]
    for a in appts:
        rows.append([
            f'{a.scheduled_at:%d/%m/%Y %H:%M}',
            f'Dr. {a.doctor.first_name} {a.doctor.last_name}',
            a.get_appointment_type_display(),
            a.get_status_display(),
        ])
    return _table_section('Citas médicas', rows, styles, P, S, T, TS, colors, cm)


def _section_insights(patient, styles, P, S, T, TS, colors, cm):
    from apps.analytics.models import HealthInsight
    insights = HealthInsight.objects.filter(patient=patient).order_by('-created_at')[:5]
    elements = [P('Insights de salud', styles['Heading2']), S(1, 0.3*cm)]
    for ins in insights:
        elements.append(P(f'<b>{ins.get_insight_type_display()}</b> — {ins.summary}', styles['Normal']))
        if ins.detail:
            elements.append(P(ins.detail, styles['Normal']))
        elements.append(S(1, 0.2*cm))
    elements.append(S(1, 0.4*cm))
    return elements


# ── Helper ────────────────────────────────────────────────────────────────────

def _table_section(title, rows, styles, P, S, T, TS, colors, cm):
    from reportlab.lib import colors as _colors
    elements = [P(title, styles['Heading2']), S(1, 0.2*cm)]
    if len(rows) > 1:
        tbl = T(rows)
        tbl.setStyle(TS([
            ('BACKGROUND',  (0, 0), (-1, 0), _colors.HexColor('#2D6A4F')),
            ('TEXTCOLOR',   (0, 0), (-1, 0), _colors.white),
            ('FONTSIZE',    (0, 0), (-1, 0), 9),
            ('FONTSIZE',    (0, 1), (-1, -1), 8),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [_colors.white, _colors.HexColor('#F0F4F1')]),
            ('GRID',        (0, 0), (-1, -1), 0.25, _colors.grey),
            ('VALIGN',      (0, 0), (-1, -1), 'MIDDLE'),
        ]))
        elements.append(tbl)
    else:
        elements.append(P('Sin registros.', styles['Normal']))
    elements.append(S(1, 0.5*cm))
    return elements
