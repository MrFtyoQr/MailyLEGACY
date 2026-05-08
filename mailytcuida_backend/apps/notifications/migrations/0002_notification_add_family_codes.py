# Generated manually — adds FAMILY_CARE_* notification codes
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('notifications', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='notification',
            name='code',
            field=models.CharField(
                choices=[
                    ('MEDICATION_REMINDER', 'Recordatorio de medicamento'),
                    ('MEDICATION_LOW_ADHERENCE', 'Baja adherencia'),
                    ('APPOINTMENT_CONFIRMED', 'Cita confirmada'),
                    ('APPOINTMENT_REMINDER_24H', 'Recordatorio 24h'),
                    ('APPOINTMENT_REMINDER_1H', 'Recordatorio 1h'),
                    ('APPOINTMENT_CANCELLED', 'Cita cancelada'),
                    ('APPOINTMENT_RESCHEDULED', 'Cita reagendada'),
                    ('VITAL_ABNORMAL', 'Vital fuera de rango'),
                    ('LAB_RESULT_ABNORMAL', 'Resultado anormal'),
                    ('DOCTOR_MESSAGE', 'Mensaje del doctor'),
                    ('PRESCRIPTION_RECEIVED', 'Receta recibida'),
                    ('BADGE_EARNED', 'Badge desbloqueado'),
                    ('PARTNER_ENROLLED', 'Alta en programa corporativo'),
                    ('VIDEO_SESSION_READY', 'Sesión de video lista'),
                    ('PATIENT_WAITING', 'Paciente en sala de espera'),
                    ('REFERRAL_RECEIVED', 'Referido recibido'),
                    ('REFERRAL_STATUS_CHANGED', 'Estado de referido actualizado'),
                    ('PAYMENT_FAILED', 'Pago fallido'),
                    ('SURVEY_ASSIGNED', 'Nueva encuesta asignada'),
                    ('SURVEY_COMPLETED', 'Encuesta completada'),
                    ('NUTRITION_PLAN_ASSIGNED', 'Plan nutricional asignado'),
                    ('WELLNESS_PROGRAM_ENROLLED', 'Inscripción a programa de bienestar'),
                    ('WELLNESS_PROGRAM_COMPLETED', 'Programa de bienestar completado'),
                    ('WELCOME', 'Bienvenida'),
                    ('FAMILY_CARE_REQUEST', 'Solicitud de cuidado familiar'),
                    ('FAMILY_VITAL_REMINDER', 'Recordatorio de signo vital'),
                    ('FAMILY_DOCTOR_DISPATCHED', 'Médico despachado por familiar'),
                    ('FAMILY_PAYMENT_RECEIVED', 'Pago de medicamento recibido'),
                ],
                db_index=True,
                max_length=30,
            ),
        ),
    ]
