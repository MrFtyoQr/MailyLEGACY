import uuid
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('accounts',      '0001_initial'),
        ('appointments',  '0001_initial'),
        ('medications',   '0001_initial'),
        ('prescriptions', '0001_initial'),
        ('vitals',        '0001_initial'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='FamilyCareLink',
            fields=[
                ('id',                models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('relationship_type', models.CharField(choices=[('PARENT','Padre/Madre cuida a hijo/a'),('CHILD','Hijo/a cuida a padre/madre'),('SPOUSE','Cónyuge'),('SIBLING','Hermano/a'),('OTHER','Otro')], max_length=10)),
                ('status',            models.CharField(choices=[('PENDING_CONSENT','Esperando consentimiento'),('ACTIVE','Activo'),('REVOKED','Revocado')], db_index=True, default='PENDING_CONSENT', max_length=20)),
                ('permissions',       models.JSONField(default=dict)),
                ('requested_at',      models.DateTimeField(auto_now_add=True)),
                ('consent_at',        models.DateTimeField(blank=True, null=True)),
                ('revoked_at',        models.DateTimeField(blank=True, null=True)),
                ('caregiver',         models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='care_links_as_caregiver', to=settings.AUTH_USER_MODEL)),
                ('patient',           models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='care_links_as_patient', to=settings.AUTH_USER_MODEL)),
            ],
            options={'db_table': 'family_care_link'},
        ),
        migrations.AddConstraint(
            model_name='familycarelink',
            constraint=models.UniqueConstraint(fields=('caregiver', 'patient'), name='unique_caregiver_patient'),
        ),
        migrations.CreateModel(
            name='VitalMonitorConfig',
            fields=[
                ('id',                       models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('vital_type',               models.CharField(max_length=20)),
                ('reminder_frequency_hours', models.PositiveIntegerField(default=24)),
                ('last_patient_reading_at',  models.DateTimeField(blank=True, null=True)),
                ('last_reminder_sent_at',    models.DateTimeField(blank=True, null=True)),
                ('is_active',                models.BooleanField(default=True)),
                ('created_at',               models.DateTimeField(auto_now_add=True)),
                ('updated_at',               models.DateTimeField(auto_now=True)),
                ('care_link',                models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='monitor_configs', to='family_care.familycarelink')),
            ],
            options={'db_table': 'family_care_vital_monitor_config'},
        ),
        migrations.AddConstraint(
            model_name='vitalmonitorconfig',
            constraint=models.UniqueConstraint(fields=('care_link', 'vital_type'), name='unique_monitor_vital_per_link'),
        ),
        migrations.CreateModel(
            name='CareAlert',
            fields=[
                ('id',           models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('alert_type',   models.CharField(choices=[('VITAL_ABNORMAL','Vital fuera de rango'),('VITAL_OVERDUE','Vital no registrado'),('MEDICATION_MISSED','Medicamento no tomado')], db_index=True, max_length=20)),
                ('vital_type',   models.CharField(blank=True, max_length=20)),
                ('severity',     models.CharField(choices=[('LOW','Baja'),('MEDIUM','Media'),('HIGH','Alta'),('CRITICAL','Crítica')], db_index=True, max_length=10)),
                ('status',       models.CharField(choices=[('OPEN','Abierta'),('DISPATCHED_DOCTOR','Médico despachado'),('DISMISSED','Descartada')], db_index=True, default='OPEN', max_length=20)),
                ('notes',        models.TextField(blank=True)),
                ('created_at',   models.DateTimeField(auto_now_add=True)),
                ('resolved_at',  models.DateTimeField(blank=True, null=True)),
                ('care_link',    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='alerts', to='family_care.familycarelink')),
                ('dismissed_by', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='dismissed_alerts', to=settings.AUTH_USER_MODEL)),
                ('appointment',  models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='appointments.appointment')),
                ('vital_sign',   models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='vitals.vitalsign')),
                ('medication_history', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='medications.medicationhistory')),
            ],
            options={'db_table': 'family_care_alert', 'ordering': ['-created_at']},
        ),
        migrations.CreateModel(
            name='MedicationPayment',
            fields=[
                ('id',                       models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ('description',              models.CharField(max_length=255)),
                ('amount_mxn',               models.DecimalField(decimal_places=2, max_digits=10)),
                ('stripe_payment_intent_id', models.CharField(blank=True, max_length=100)),
                ('status',                   models.CharField(choices=[('PENDING','Pendiente'),('PAID','Pagado'),('FAILED','Fallido'),('REFUNDED','Reembolsado')], db_index=True, default='PENDING', max_length=10)),
                ('paid_at',                  models.DateTimeField(blank=True, null=True)),
                ('created_at',               models.DateTimeField(auto_now_add=True)),
                ('care_link',                models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='medication_payments', to='family_care.familycarelink')),
                ('medication',               models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='medications.medication')),
                ('prescription',             models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to='prescriptions.prescription')),
            ],
            options={'db_table': 'family_care_medication_payment', 'ordering': ['-created_at']},
        ),
    ]
