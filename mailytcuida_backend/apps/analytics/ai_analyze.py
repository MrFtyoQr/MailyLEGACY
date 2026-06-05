"""
ai_analyze.py
-------------
POST /api/v1/analytics/analyze/

Endpoint unificado de análisis con IA para laboratorios y recetas médicas.

- type: "lab_panel" | "prescription"
- id:   UUID del recurso a analizar

Usa gpt-4o-mini (económico, rápido).
Solo datos numéricos y anónimos se envían a OpenAI — sin nombre, sin ID.
Siempre cita fuentes oficiales (OMS, NOM-SSA, AHA, ADA).
Nunca emite diagnóstico.
"""

import json
import logging
from rest_framework.views      import APIView
from rest_framework.response   import Response
from rest_framework            import permissions, status
from django.conf               import settings

logger = logging.getLogger(__name__)

DISCLAIMER = (
    "⚕️ Este análisis es orientativo y no constituye un diagnóstico médico. "
    "Consulta a tu médico o especialista para interpretación clínica personalizada. "
    "(NOM-004-SSA3-2012)"
)

# ── Prompt base ───────────────────────────────────────────────────────────────

LAB_SYSTEM = """Eres un asistente de orientación médica de MailyT Cuida.
REGLAS ESTRICTAS:
1. Analiza los resultados comparando con rangos de la OMS, NOM-SSA mexicana, AHA o ADA.
2. NUNCA diagnostiques enfermedades ni recetes tratamientos.
3. Para cada parámetro indica: Normal / Bajo / Alto y cita la fuente exacta.
4. Usa lenguaje claro y empático en español.
5. Termina siempre con la frase: "Te recomendamos acudir con tu médico para una evaluación clínica."
6. Máximo 250 palabras.
Formato de respuesta: texto corrido con saltos de línea, sin JSON."""

RX_SYSTEM = """Eres un asistente de orientación médica de MailyT Cuida.
REGLAS ESTRICTAS:
1. Explica de forma sencilla para qué sirve cada medicamento de la receta.
2. Menciona precauciones generales conocidas (alergias comunes, interacciones frecuentes).
3. Basa toda información en fuentes oficiales: COFEPRIS, NOM-177-SSA1, prospecto de la OPS.
4. NUNCA indiques modificar la dosis ni el tratamiento del médico.
5. Si el médico incluyó razón o diagnóstico, explícalo en términos simples.
6. Usa lenguaje claro y empático en español.
7. Termina siempre con: "Sigue las indicaciones de tu médico al pie de la letra."
8. Máximo 300 palabras.
Formato de respuesta: texto corrido con saltos de línea, sin JSON."""


def _call_openai(system_prompt: str, user_prompt: str) -> str:
    """Llama a gpt-4o-mini y retorna el texto de respuesta."""
    import openai
    client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system",  "content": system_prompt},
            {"role": "user",    "content": user_prompt},
        ],
        max_tokens=500,
        temperature=0.3,
    )
    return resp.choices[0].message.content.strip()


def _analyze_lab_panel(panel_id: str, patient) -> str:
    from apps.lab_results.models import LabPanel
    try:
        panel = LabPanel.objects.prefetch_related('results').get(
            pk=panel_id, patient=patient
        )
    except LabPanel.DoesNotExist:
        raise ValueError("Panel de laboratorio no encontrado.")

    results = panel.results.all()
    if not results:
        raise ValueError("El panel no tiene resultados registrados.")

    lines = [f"Panel: {panel.panel_name or 'Análisis de laboratorio'}", f"Fecha: {panel.performed_at}"]
    for r in results:
        ref = ""
        if r.ref_min is not None and r.ref_max is not None:
            ref = f"(rango: {r.ref_min}–{r.ref_max} {r.unit})"
        elif r.ref_text:
            ref = f"(referencia: {r.ref_text})"
        estado = {
            'NORMAL': 'Normal',
            'ABNORMAL_LOW': '⬇ Bajo',
            'ABNORMAL_HIGH': '⬆ Alto',
            'CRITICAL': '🚨 Crítico',
            'UNKNOWN': 'Sin referencia',
        }.get(r.status, r.status)
        lines.append(f"- {r.parameter}: {r.value} {r.unit} {ref} → {estado}")

    return _call_openai(LAB_SYSTEM, "\n".join(lines))


def _analyze_prescription(rx_id: str, patient) -> str:
    from apps.prescriptions.models import Prescription
    try:
        rx = Prescription.objects.get(pk=rx_id, patient=patient, is_active=True)
    except Prescription.DoesNotExist:
        raise ValueError("Receta no encontrada.")

    lines = []
    if rx.prescribed_by:
        lines.append(f"Médico: {rx.prescribed_by}")
    if rx.notes:
        lines.append(f"Motivo / descripción del médico: {rx.notes}")
    if rx.medications_listed:
        lines.append("Medicamentos recetados:")
        for m in rx.medications_listed:
            name  = m.get('name', '')
            dose  = m.get('dose', '') or m.get('dosage', '')
            instr = m.get('instructions', '') or m.get('frequency', '')
            lines.append(f"  • {name} {dose} — {instr}".strip(" —"))
    else:
        lines.append("(Sin medicamentos estructurados — receta manual)")

    if not lines:
        raise ValueError("La receta no tiene información suficiente para analizar.")

    return _call_openai(RX_SYSTEM, "\n".join(lines))


# ── Vista ─────────────────────────────────────────────────────────────────────

class AIAnalyzeView(APIView):
    """
    POST /api/v1/analytics/analyze/
    {
      "type": "lab_panel" | "prescription",
      "id":   "<uuid>"
    }
    """
    permission_classes = [permissions.IsAuthenticated]
    throttle_scope = "ai_analyze"   # 10/hour para no abusar de OpenAI

    def post(self, request):
        analyze_type = request.data.get("type", "").strip()
        resource_id  = request.data.get("id",   "").strip()

        if analyze_type not in ("lab_panel", "prescription"):
            return Response(
                {"error": "type debe ser 'lab_panel' o 'prescription'"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not resource_id:
            return Response({"error": "id es requerido"}, status=status.HTTP_400_BAD_REQUEST)

        if not settings.OPENAI_API_KEY:
            return Response(
                {"error": "Análisis IA no disponible en este momento."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        # Obtener perfil del paciente
        try:
            patient = request.user.patient_profile
        except Exception:
            return Response({"error": "Perfil de paciente no encontrado."}, status=400)

        try:
            if analyze_type == "lab_panel":
                analysis = _analyze_lab_panel(resource_id, patient)
            else:
                analysis = _analyze_prescription(resource_id, patient)
        except ValueError as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.exception("AIAnalyzeView error: %s", e)
            return Response(
                {"error": "No se pudo generar el análisis. Intenta más tarde."},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response({
            "analysis":   analysis,
            "disclaimer": DISCLAIMER,
            "type":       analyze_type,
        })
