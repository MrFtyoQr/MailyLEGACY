"""
Public API for other modules. Use notify() — never import tasks directly.

Usage:
    from apps.notifications.service import notify

    notify(
        user=patient.user,
        code='MEDICATION_REMINDER',
        context={'medication_name': 'Metformina', 'time': '08:00'},
        channel='PUSH',       # optional; defaults to PUSH
        data={'screen': 'history', 'id': str(history_id)},
    )
"""
import logging
from django.conf import settings

logger = logging.getLogger(__name__)

# ── Content templates (ES) ────────────────────────────────────────────────────

_TEMPLATES: dict[str, dict] = {
    'MEDICATION_REMINDER': {
        'title': 'Hora de tu medicamento',
        'body':  'Es momento de tomar {medication_name} ({dosage} {unit}).',
    },
    'MEDICATION_LOW_ADHERENCE': {
        'title': 'Adherencia baja detectada',
        'body':  'El paciente {patient_name} tiene una adherencia del {adherence_pct}% en los últimos 7 días.',
    },
    'APPOINTMENT_CONFIRMED': {
        'title': 'Cita confirmada',
        'body':  'Tu cita con el Dr. {doctor_name} el {date} a las {time} ha sido confirmada.',
    },
    'APPOINTMENT_REMINDER_24H': {
        'title': 'Recordatorio de cita',
        'body':  'Mañana tienes cita con el Dr. {doctor_name} a las {time}.',
    },
    'APPOINTMENT_REMINDER_1H': {
        'title': 'Tu cita es en 1 hora',
        'body':  'Recuerda tu consulta con el Dr. {doctor_name} a las {time}.',
    },
    'APPOINTMENT_CANCELLED': {
        'title': 'Cita cancelada',
        'body':  'Tu cita del {date} con el Dr. {doctor_name} ha sido cancelada.',
    },
    'APPOINTMENT_RESCHEDULED': {
        'title': 'Cita reagendada',
        'body':  'Tu cita con el Dr. {doctor_name} fue reagendada para el {date} a las {time}.',
    },
    'VITAL_ABNORMAL': {
        'title': 'Signo vital fuera de rango',
        'body':  'Tu {vital_type} ({value} {unit}) está fuera del rango recomendado.',
    },
    'LAB_RESULT_ABNORMAL': {
        'title': 'Resultado de laboratorio anormal',
        'body':  '{parameter}: {value} {unit} — {status}. Revisa tus recomendaciones.',
    },
    'DOCTOR_MESSAGE': {
        'title': 'Nuevo mensaje',
        'body':  'El Dr. {doctor_name} te envió un mensaje.',
    },
    'VIDEO_SESSION_READY': {
        'title': 'Tu consulta por video está lista',
        'body':  'El Dr. {doctor_name} ha preparado tu sala. Entra aquí: {meeting_url}',
    },
    'PATIENT_WAITING': {
        'title': 'Paciente en sala de espera',
        'body':  '{patient_name} está esperando en la sala virtual. Ingresa cuando estés listo.',
    },
    'PARTNER_ENROLLED': {
        'title': 'Alta en programa de salud corporativo',
        'body':  '{organization_name} te ha inscrito en su programa de salud. Revisa y acepta en tu app.',
    },
    'BADGE_EARNED': {
        'title': '🏅 ¡Badge desbloqueado!',
        'body':  'Ganaste el badge "{badge_name}". {badge_description}',
    },
    'REFERRAL_RECEIVED': {
        'title': 'Nuevo referido recibido',
        'body':  'El Dr. {doctor_name} te refirió al paciente {patient_name} (urgencia: {urgency}).',
    },
    'REFERRAL_STATUS_CHANGED': {
        'title': 'Actualización de referido',
        'body':  '{specialist_name} actualizó el estado del referido de {patient_name}: {new_status}.',
    },
    'PRESCRIPTION_RECEIVED': {
        'title': 'Nueva receta médica',
        'body':  'El Dr. {doctor_name} de {clinic_name} te ha enviado una receta. Consúltala en tu app.',
    },
    'PAYMENT_FAILED': {
        'title': 'Pago no procesado',
        'body':  'No pudimos procesar tu pago para el plan {plan_name}. Actualiza tu método de pago.',
    },
    'WELCOME': {
        'title': '¡Bienvenido a MailyT Cuida!',
        'body':  'Hola {first_name}, tu cuenta ha sido creada exitosamente.',
    },
    'SURVEY_ASSIGNED': {
        'title': 'Nueva encuesta disponible',
        'body':  'Tu médico te ha enviado una encuesta. Respóndela antes de {due_date}.',
    },
    'SURVEY_COMPLETED': {
        'title': 'Encuesta completada',
        'body':  'El paciente ha completado la encuesta "{survey_title}".',
    },
    'NUTRITION_PLAN_ASSIGNED': {
        'title': 'Plan nutricional disponible',
        'body':  'Tu médico te ha asignado el plan "{plan_title}". Comienza hoy.',
    },
    'WELLNESS_PROGRAM_ENROLLED': {
        'title': 'Nuevo programa de bienestar',
        'body':  'Has sido inscrito en "{program_title}". ¡Empieza tu primera actividad!',
    },
    'WELLNESS_PROGRAM_COMPLETED': {
        'title': '¡Programa completado! 🎉',
        'body':  'Felicidades, has completado el programa "{program_title}".',
    },
    # ── Cuidado Familiar ──────────────────────────────────────────────────────
    'FAMILY_CARE_REQUEST': {
        'title': 'Solicitud de cuidado familiar',
        'body':  '{caregiver_email} quiere cuidarte como {relationship}. Acepta o rechaza en tu app.',
    },
    'FAMILY_VITAL_REMINDER': {
        'title': 'Recordatorio de signo vital',
        'body':  'Llevas más de {hours}h sin registrar tu {vital_type}. Tu familiar está pendiente de ti.',
    },
    'FAMILY_DOCTOR_DISPATCHED': {
        'title': 'Tu familiar agendó una cita',
        'body':  '{caregiver_email} agendó una cita con {doctor_name} para el {scheduled_at}.',
    },
    'FAMILY_PAYMENT_RECEIVED': {
        'title': 'Pago de medicamento recibido',
        'body':  'Tu familiar pagó {description}. Revisa los detalles en tu app.',
    },
}


def _render(template: dict, context: dict) -> tuple[str, str]:
    title = template['title'].format_map(_SafeDict(context))
    body  = template['body'].format_map(_SafeDict(context))
    return title, body


class _SafeDict(dict):
    """Returns '{key}' for missing keys instead of raising KeyError."""
    def __missing__(self, key):
        return f'{{{key}}}'


# ── Public API ────────────────────────────────────────────────────────────────

def notify(user, code: str, context: dict | None = None,
           channel: str = 'PUSH', data: dict | None = None) -> None:
    """
    Create a Notification record and enqueue dispatch.
    Safe to call from anywhere — non-blocking (Celery async).
    """
    from .models import Notification
    from .tasks import dispatch_notification

    template = _TEMPLATES.get(code)
    if not template:
        logger.warning('notify(): unknown code %s', code)
        return

    title, body = _render(template, context or {})

    notif = Notification.objects.create(
        user=user,
        code=code,
        channel=channel,
        title=title,
        body=body,
        data=data or {},
    )
    dispatch_notification.delay(str(notif.pk))


# ── Low-level senders ─────────────────────────────────────────────────────────

def send_push(user, title: str, body: str, data: dict | None = None,
              notification_id: str = '', code: str = '', created_at: str = '') -> bool:
    """
    Envía notificación en tiempo real vía WebSocket (Django Channels).

    El móvil mantiene una conexión persistente a ws://<host>/ws/notifications/
    y recibe el payload aquí. El móvil decide cómo mostrarlo localmente
    (notificación del sistema, badge, sonido) — sin Firebase.

    Si el usuario no está conectado, la notificación queda en DB como PENDING
    y se entrega en el próximo connect() del consumer.

    Returns True si el channel layer aceptó el mensaje.
    """
    try:
        from asgiref.sync import async_to_sync
        from channels.layers import get_channel_layer
        from .consumers import _group_name

        channel_layer = get_channel_layer()
        if channel_layer is None:
            logger.warning('send_push: channel layer no disponible (Redis caído?)')
            return False

        async_to_sync(channel_layer.group_send)(
            _group_name(user.pk),
            {
                'type':       'notification_push',
                'id':         notification_id,
                'code':       code,
                'title':      title,
                'body':       body,
                'data':       data or {},
                'created_at': created_at,
            },
        )
        logger.debug('send_push (ws): entregado al grupo notif_%s', user.pk)
        return True
    except Exception as exc:
        logger.error('send_push (ws) falló para user %s: %s', user.pk, exc)
        return False


def send_email(user, subject: str, body_text: str) -> bool:
    """
    Send transactional email via SendGrid (primary) or Django SMTP fallback.
    """
    if not user.email:
        return False

    provider = getattr(settings, 'EMAIL_PROVIDER', 'django')

    try:
        if provider == 'sendgrid':
            return _send_via_sendgrid(user.email, subject, body_text)
        else:
            from django.core.mail import send_mail
            send_mail(
                subject=subject,
                message=body_text,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[user.email],
                fail_silently=False,
            )
            return True
    except Exception as exc:
        logger.error('send_email failed for %s: %s', user.email, exc)
        return False


def _send_via_sendgrid(to_email: str, subject: str, body_text: str) -> bool:
    import sendgrid
    from sendgrid.helpers.mail import Mail

    sg = sendgrid.SendGridAPIClient(api_key=settings.SENDGRID_API_KEY)
    message = Mail(
        from_email=settings.DEFAULT_FROM_EMAIL,
        to_emails=to_email,
        subject=subject,
        plain_text_content=body_text,
    )
    response = sg.send(message)
    return response.status_code in (200, 202)
