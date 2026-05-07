"""
Management command: seed_dev_data

Creates a complete set of test fixtures for local dev/Postman testing.
Idempotent — safe to run multiple times.

Users created:
  admin@mailyt.dev          role=ADMIN    (Django superuser)
  doctor@mailyt.dev         role=DOCTOR
  paciente@mailyt.dev       role=PATIENT  (padre, el que recibe cuidados)
  paciente2@mailyt.dev      role=PATIENT
  hijo@mailyt.dev           role=PATIENT  (cuidador del paciente principal)
  especialista@mailyt.dev   role=SPECIALIST
  partner@mailyt.dev        role=PARTNER

All emails use X-Dev-User-Email header for Postman auth (DEV_AUTH_BYPASS=True).
"""
import uuid
from datetime import date, timedelta
from django.utils import timezone

from django.core.management.base import BaseCommand
from django.db import transaction


def _uid():
    return f'dev_{uuid.uuid4().hex[:12]}'


def _dt(days_ago: int, hour: int = 8):
    return timezone.now().replace(hour=hour, minute=0, second=0, microsecond=0) - timedelta(days=days_ago)


class Command(BaseCommand):
    help = 'Seed development data for Postman testing (idempotent).'

    def handle(self, *args, **options):
        from apps.accounts.models import DoctorProfile, PatientProfile, PartnerProfile, User

        self.stdout.write(self.style.MIGRATE_HEADING('==> Seeding dev users...'))

        with transaction.atomic():
            # ── Admin ──────────────────────────────────────────────────────────
            admin, created = User.objects.get_or_create(
                email='admin@mailyt.dev',
                defaults={'clerk_id': _uid(), 'role': 'ADMIN', 'is_staff': True, 'is_superuser': True},
            )
            admin.is_staff = True
            admin.is_superuser = True
            admin.set_password('Admin1234!')
            admin.save(update_fields=['is_staff', 'is_superuser', 'password'])
            self.stdout.write('  ✓ admin@mailyt.dev')

            # ── Doctor ─────────────────────────────────────────────────────────
            doctor_user, _ = User.objects.get_or_create(
                email='doctor@mailyt.dev',
                defaults={'clerk_id': _uid(), 'role': 'DOCTOR'},
            )
            doctor_profile, _ = DoctorProfile.objects.get_or_create(
                user=doctor_user,
                defaults={
                    'first_name': 'Carlos', 'last_name': 'Mendoza',
                    'license_number': 'CEDULA-DEV-001',
                    'specialty': 'Medicina General',
                    'hospital': 'Hospital MailyT Dev',
                },
            )
            self.stdout.write('  ✓ doctor@mailyt.dev')

            # ── Patient (padre — recibe cuidados) ──────────────────────────────
            patient_user, _ = User.objects.get_or_create(
                email='paciente@mailyt.dev',
                defaults={'clerk_id': _uid(), 'role': 'PATIENT'},
            )
            patient_profile, _ = PatientProfile.objects.get_or_create(
                user=patient_user,
                defaults={
                    'first_name': 'Roberto', 'last_name': 'García',
                    'birth_date': date(1955, 5, 14),
                    'sex': 'M', 'blood_type': 'O+',
                    'allergies': ['penicilina'],
                    'chronic_conditions': ['diabetes tipo 2', 'hipertensión'],
                    'emergency_contact_name': 'Carlos García',
                    'emergency_contact_phone': '+52 55 1234 5678',
                },
            )
            self.stdout.write('  ✓ paciente@mailyt.dev')

            # ── Patient 2 ──────────────────────────────────────────────────────
            patient2_user, _ = User.objects.get_or_create(
                email='paciente2@mailyt.dev',
                defaults={'clerk_id': _uid(), 'role': 'PATIENT'},
            )
            PatientProfile.objects.get_or_create(
                user=patient2_user,
                defaults={
                    'first_name': 'Luis', 'last_name': 'Ramírez',
                    'birth_date': date(1985, 11, 3),
                    'sex': 'M', 'blood_type': 'A+',
                    'allergies': [], 'chronic_conditions': ['asma'],
                },
            )
            self.stdout.write('  ✓ paciente2@mailyt.dev')

            # ── Hijo (cuidador del paciente principal) ─────────────────────────
            hijo_user, _ = User.objects.get_or_create(
                email='hijo@mailyt.dev',
                defaults={'clerk_id': _uid(), 'role': 'PATIENT'},
            )
            PatientProfile.objects.get_or_create(
                user=hijo_user,
                defaults={
                    'first_name': 'Carlos', 'last_name': 'García',
                    'birth_date': date(1985, 3, 20),
                    'sex': 'M', 'blood_type': 'A+',
                    'allergies': [], 'chronic_conditions': [],
                },
            )
            self.stdout.write('  ✓ hijo@mailyt.dev')

            # ── Specialist ─────────────────────────────────────────────────────
            spec_user, _ = User.objects.get_or_create(
                email='especialista@mailyt.dev',
                defaults={'clerk_id': _uid(), 'role': 'SPECIALIST'},
            )
            self.stdout.write('  ✓ especialista@mailyt.dev')

            # ── Partner ────────────────────────────────────────────────────────
            partner_user, _ = User.objects.get_or_create(
                email='partner@mailyt.dev',
                defaults={'clerk_id': _uid(), 'role': 'PARTNER'},
            )
            PartnerProfile.objects.get_or_create(
                user=partner_user,
                defaults={
                    'business_name': 'Empresa Demo SA de CV',
                    'contact_email': 'partner@mailyt.dev',
                    'description': 'Partner de prueba para desarrollo.',
                },
            )
            self.stdout.write('  ✓ partner@mailyt.dev')

        # ── Vitals (30 días) ───────────────────────────────────────────────────
        self.stdout.write(self.style.MIGRATE_HEADING('==> Seeding vitals...'))
        self._seed_vitals(patient_profile)

        # ── Medications + adherencia ───────────────────────────────────────────
        self.stdout.write(self.style.MIGRATE_HEADING('==> Seeding medications...'))
        self._seed_medications(patient_profile)

        # ── Appointments ───────────────────────────────────────────────────────
        self.stdout.write(self.style.MIGRATE_HEADING('==> Seeding appointments...'))
        self._seed_appointments(patient_profile, doctor_profile)

        # ── DoctorPatient link ─────────────────────────────────────────────────
        self._seed_doctor_patient(patient_profile, doctor_profile)

        # ── Family Care ────────────────────────────────────────────────────────
        self.stdout.write(self.style.MIGRATE_HEADING('==> Seeding family care...'))
        self._seed_family_care(hijo_user, patient_user)

        # ── Summary ────────────────────────────────────────────────────────────
        self.stdout.write('')
        self.stdout.write(self.style.MIGRATE_HEADING('==> Dev seed complete. Postman headers:'))
        self.stdout.write('')
        self.stdout.write('  ADMIN      →  X-Dev-User-Email: admin@mailyt.dev')
        self.stdout.write('  DOCTOR     →  X-Dev-User-Email: doctor@mailyt.dev')
        self.stdout.write('  PACIENTE   →  X-Dev-User-Email: paciente@mailyt.dev  (es el padre)')
        self.stdout.write('  HIJO       →  X-Dev-User-Email: hijo@mailyt.dev       (es el cuidador)')
        self.stdout.write('  PACIENTE2  →  X-Dev-User-Email: paciente2@mailyt.dev')
        self.stdout.write('  SPECIALIST →  X-Dev-User-Email: especialista@mailyt.dev')
        self.stdout.write('  PARTNER    →  X-Dev-User-Email: partner@mailyt.dev')
        self.stdout.write('')
        self.stdout.write('  Flujo family-care:')
        self.stdout.write('    1. Como hijo@mailyt.dev: GET /api/v1/family-care/links/')
        self.stdout.write('    2. Como hijo@mailyt.dev: GET /api/v1/family-care/links/<id>/vitals/frequency/')
        self.stdout.write('    3. Como hijo@mailyt.dev: GET /api/v1/family-care/links/<id>/medications/')
        self.stdout.write('    4. Como hijo@mailyt.dev: GET /api/v1/family-care/links/<id>/alerts/')
        self.stdout.write('')

    def _seed_vitals(self, patient_profile):
        try:
            from apps.vitals.models import VitalSign
        except ImportError:
            return

        vitals_data = []
        for days_ago in range(30, 0, -1):
            vitals_data.append(('BLOOD_PRESSURE', 125 + (days_ago % 10), 'mmHg', days_ago, 8))
            if days_ago % 3 == 0:
                vitals_data.append(('HEART_RATE', 72 + (days_ago % 15), 'bpm', days_ago, 9))
            if days_ago <= 7:
                vitals_data.append(('OXYGEN_SAT', 97.0 - (0.5 if days_ago % 2 == 0 else 0), '%', days_ago, 10))
                vitals_data.append(('TEMPERATURE', 36.5 + (0.3 if days_ago % 4 == 0 else 0), '°C', days_ago, 10))
            if days_ago % 2 == 0:
                vitals_data.append(('GLUCOSE', 130 + (days_ago % 20), 'mg/dL', days_ago, 7))

        for vital_type, value, unit, days_ago, hour in vitals_data:
            VitalSign.objects.get_or_create(
                patient=patient_profile,
                vital_type=vital_type,
                recorded_at=_dt(days_ago, hour),
                defaults={'value': value, 'unit': unit, 'notes': 'seed'},
            )
        self.stdout.write(f'  ✓ {len(vitals_data)} vitals')

    def _seed_medications(self, patient_profile):
        try:
            from apps.medications.models import Medication, MedicationHistory
        except ImportError:
            return

        meds_data = [
            ('Metformina', '500', 'mg'),
            ('Enalapril',  '10',  'mg'),
            ('Aspirina',   '81',  'mg'),
        ]
        for name, dosage, unit in meds_data:
            med, _ = Medication.objects.get_or_create(
                patient=patient_profile,
                name=name,
                defaults={'dosage': dosage, 'unit': unit, 'is_active': True},
            )
            for days_ago in range(14, 0, -1):
                taken = (days_ago % 5) != 0
                MedicationHistory.objects.get_or_create(
                    patient=patient_profile,
                    medication=med,
                    scheduled_at=_dt(days_ago, 8),
                    defaults={
                        'medication_name': name,
                        'status': 'TAKEN' if taken else 'SKIPPED',
                        'actual_taken_at': _dt(days_ago, 8) if taken else None,
                    },
                )
        self.stdout.write('  ✓ 3 medications + 42 history records')

    def _seed_appointments(self, patient_profile, doctor_profile):
        try:
            from apps.appointments.models import Appointment, AppointmentNote
        except ImportError:
            return

        appointments_data = [
            (_dt(20), 'COMPLETED', 'Revisión trimestral diabetes'),
            (_dt(10), 'COMPLETED', 'Control de presión arterial'),
            (_dt(-7), 'CONFIRMED', 'Seguimiento medicamentos'),
        ]
        for sched_at, appt_status, reason in appointments_data:
            appt, created = Appointment.objects.get_or_create(
                patient=patient_profile,
                scheduled_at=sched_at,
                defaults={
                    'doctor': doctor_profile,
                    'status': appt_status,
                    'appointment_type': 'IN_PERSON',
                    'reason': reason,
                },
            )
            if created and appt_status == 'COMPLETED':
                AppointmentNote.objects.get_or_create(
                    appointment=appt,
                    defaults={
                        'chief_complaint': f'Paciente refiere {reason.lower()}.',
                        'diagnosis': 'Diabetes tipo 2 con control moderado. PA 130/85 mmHg.',
                        'treatment_plan': 'Continuar con Metformina. Dieta baja en carbohidratos.',
                    },
                )
        self.stdout.write('  ✓ 3 appointments')

    def _seed_doctor_patient(self, patient_profile, doctor_profile):
        try:
            from apps.accounts.models import DoctorPatient
            DoctorPatient.objects.get_or_create(
                patient=patient_profile,
                doctor=doctor_profile,
                defaults={'is_active': True},
            )
            self.stdout.write('  ✓ DoctorPatient link')
        except Exception:
            pass

    def _seed_family_care(self, hijo_user, patient_user):
        try:
            from apps.family_care.models import (
                FamilyCareLink, VitalMonitorConfig, CareAlert, MedicationPayment
            )
        except ImportError:
            self.stdout.write('  ⚠ family_care no disponible (¿migraciones pendientes?)')
            return

        link, _ = FamilyCareLink.objects.get_or_create(
            caregiver=hijo_user,
            patient=patient_user,
            defaults={
                'relationship_type': 'CHILD',
                'status': 'ACTIVE',
                'consent_at': _dt(25),
                'permissions': {
                    'vitals': True, 'medications': True, 'appointments': True,
                    'can_dispatch_doctor': True, 'can_pay_meds': True,
                },
            },
        )
        self.stdout.write('  ✓ FamilyCareLink hijo→paciente (ACTIVE)')

        for vital_type, hours in [('BLOOD_PRESSURE', 12), ('GLUCOSE', 24), ('OXYGEN_SAT', 48)]:
            VitalMonitorConfig.objects.get_or_create(
                care_link=link,
                vital_type=vital_type,
                defaults={
                    'reminder_frequency_hours': hours,
                    'last_patient_reading_at': _dt(1),
                    'is_active': True,
                },
            )
        self.stdout.write('  ✓ 3 VitalMonitorConfigs')

        CareAlert.objects.get_or_create(
            care_link=link,
            alert_type='VITAL_OVERDUE',
            vital_type='GLUCOSE',
            status='OPEN',
            defaults={'severity': 'MEDIUM'},
        )
        self.stdout.write('  ✓ 1 CareAlert (VITAL_OVERDUE / OPEN)')

        MedicationPayment.objects.get_or_create(
            care_link=link,
            description='Metformina 500mg x30 tabletas',
            defaults={'amount_mxn': 180.00, 'status': 'PAID', 'paid_at': _dt(5)},
        )
        self.stdout.write('  ✓ 1 MedicationPayment (PAID)')
