"""
AI service for generating health insights.
Routes to OpenAI or Anthropic Claude based on the patient's subscription tier.
Prompt caching enabled for Claude (cache_control on system prompt).
"""
import hashlib
import json
import logging
from django.conf import settings

logger = logging.getLogger(__name__)

# Model mapping per tier
_TIER_MODEL = {
    'FREE':     ('openai',    'gpt-4o-mini'),
    'SILVER':   ('openai',    'gpt-4o'),
    'GOLD':     ('openai',    'gpt-4o'),
    'PLATINUM': ('anthropic', 'claude-sonnet-4-6'),
}

_SYSTEM_PROMPT = (
    "Eres un asistente de salud inteligente de la plataforma MailyT Cuida. "
    "Analizas datos clínicos numéricos de pacientes y generas recomendaciones "
    "claras, empáticas y accionables en español. "
    "IMPORTANTE: No diagnostiques enfermedades. No menciones nombres de pacientes. "
    "Usa lenguaje sencillo, evita términos técnicos sin explicación. "
    "Responde SIEMPRE en JSON con esta estructura exacta: "
    '{"summary": "<titular de 1 línea>", '
    '"detail": "<explicación de 2-4 oraciones>", '
    '"actions": [{"action": "<acción concreta>", "priority": "high|medium|low"}]}'
)


def get_insight(patient, insight_type: str, context: dict) -> dict:
    """
    Generate a health insight using the appropriate AI provider.
    Returns: {summary, detail, actions, provider, model_used, context_hash}
    """
    tier = _get_tier(patient)
    provider, model = _TIER_MODEL.get(tier, ('openai', 'gpt-4o-mini'))

    context_hash = hashlib.sha256(
        json.dumps(context, sort_keys=True, default=str).encode()
    ).hexdigest()

    user_prompt = _build_user_prompt(insight_type, context)

    try:
        if provider == 'anthropic':
            raw = _call_claude(model, user_prompt)
        else:
            raw = _call_openai(model, user_prompt)

        result = json.loads(raw)
        result.update({
            'provider':     'ANTHROPIC' if provider == 'anthropic' else 'OPENAI',
            'model_used':   model,
            'context_hash': context_hash,
        })
        return result

    except Exception as exc:
        logger.error('AI insight generation failed (%s/%s): %s', provider, model, exc)
        return _fallback_insight(insight_type, context, context_hash)


# ── OpenAI ────────────────────────────────────────────────────────────────────

def _call_openai(model: str, user_prompt: str) -> str:
    from openai import OpenAI
    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    response = client.chat.completions.create(
        model=model,
        messages=[
            {'role': 'system', 'content': _SYSTEM_PROMPT},
            {'role': 'user',   'content': user_prompt},
        ],
        response_format={'type': 'json_object'},
        temperature=0.4,
        max_tokens=600,
    )
    return response.choices[0].message.content


# ── Anthropic Claude (with prompt caching) ────────────────────────────────────

def _call_claude(model: str, user_prompt: str) -> str:
    import anthropic
    client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

    response = client.messages.create(
        model=model,
        max_tokens=1024,
        system=[
            {
                'type': 'text',
                'text': _SYSTEM_PROMPT,
                'cache_control': {'type': 'ephemeral'},  # prompt caching
            }
        ],
        messages=[
            {'role': 'user', 'content': user_prompt}
        ],
        temperature=0.4,
    )
    return response.content[0].text


# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_tier(patient) -> str:
    try:
        return patient.user.subscription.plan.tier
    except Exception:
        return 'FREE'


def _build_user_prompt(insight_type: str, context: dict) -> str:
    context_str = json.dumps(context, ensure_ascii=False, indent=2, default=str)
    type_labels = {
        'MEDICATION_ADHERENCE': 'adherencia a medicamentos',
        'VITAL_TREND':          'tendencias de signos vitales',
        'LAB_ANALYSIS':         'resultados de laboratorio',
        'GENERAL_HEALTH':       'salud general',
    }
    label = type_labels.get(insight_type, 'salud general')
    return (
        f"Analiza los siguientes datos de salud del paciente y genera un insight "
        f"enfocado en: {label}.\n\nDatos:\n{context_str}"
    )


def _fallback_insight(insight_type: str, context: dict, context_hash: str) -> dict:
    """Rule-based fallback when AI call fails."""
    adherence = context.get('adherence', {})
    pct = adherence.get('adherence_pct', 100)

    if insight_type == 'MEDICATION_ADHERENCE':
        if pct >= 80:
            summary = f'Tu adherencia es del {pct}% — ¡sigue así!'
            detail  = 'Mantener una buena adherencia es clave para el éxito de tu tratamiento.'
            actions = [{'action': 'Continúa tomando tus medicamentos a tiempo', 'priority': 'low'}]
        else:
            summary = f'Tu adherencia bajó al {pct}% esta semana'
            detail  = 'Tomar los medicamentos de forma irregular reduce su efectividad.'
            actions = [
                {'action': 'Activa recordatorios en la app', 'priority': 'high'},
                {'action': 'Habla con tu médico si tienes efectos secundarios', 'priority': 'medium'},
            ]
    else:
        summary = 'Revisa tus datos de salud recientes'
        detail  = 'Consulta con tu médico para una interpretación personalizada.'
        actions = [{'action': 'Agenda una consulta médica', 'priority': 'medium'}]

    return {
        'summary':      summary,
        'detail':       detail,
        'actions':      actions,
        'provider':     'RULE_BASED',
        'model_used':   'fallback',
        'context_hash': context_hash,
    }
