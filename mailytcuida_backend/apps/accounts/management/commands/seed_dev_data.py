"""
Management command: seed_dev_data

Creates a minimal but complete set of test fixtures for local dev/Postman testing.
Idempotent — safe to run multiple times.

Users created:
  admin@mailyt.dev          role=ADMIN    (Django superuser)
  doctor@mailyt.dev         role=DOCTOR
  paciente@mailyt.dev       role=PATIENT
  paciente2@mailyt.dev      role=PATIENT
  especialista@mailyt.dev   role=SPECIALIST
  partner@mailyt.dev        role=PARTNER

All emails use X-Dev-User-Email header for Postman auth (DEV_AUTH_BYPASS=True).
"""
import uuid
from datetime import date, timedelta

from django.core.management.base import BaseCommand
from django.db import transaction


def _uid():
    return f'dev_{uuid.uuid4().hex[:12]}'


class Command(BaseCommand):
    help = 'Seed development data for Postman testing (idempotent).'

    def handle(self, *args, **options):
        from apps.accounts.models import (
            DoctorProfile, PatientProfile, PartnerProfile, User,
        )

        self.stdout.write(self.style.MIGRATE_HEADING('==> Seeding dev users...'))

        with transaction.atomic():
            # ── Admin ──────────────────────────────────────────────────────
            admin, created = User.objects.get_or_create(
                email='admin@mailyt.dev',
                defaults={
                    'clerk_id': _uid(),
                    'role': 'ADMIN',
                    'is_staff': True,
                    'is_superuser': True,
                },
            )
            if created:
                admin.set_password('Admin1234!')
                admin.save()
                self.stdout.write(self.style.SUCCESS('  ✓ admin@mailyt.dev created'))
            else:
                self.stdout.write('  · admin@mailyt.dev already exists')

            # ── Doctor ─────────────────────────────────────────────────────
            doctor_user, created = User.objects.get_or_create(
                email='doctor@mailyt.dev',
                defaults={'clerk_id': _uid(), 'role': 'DOCTOR'},
            )
            if created:
                self.stdout.write(self.style.SUCCESS('  ✓ doctor@mailyt.dev created'))
            DoctorProfile.objects.get_or_create(
                user=doctor_user,
                defaults={
                    'first_name': 'Carlos',
                    'last_name': 'Mendoza',
                    'license_number': 'CEDULA-DEV-001',
                    'specialty': 'Medicina General',
                    'hospital': 'Hospital MailyT Dev',
                },
            )

            # ── Patient 1 ──────────────────────────────────────────────────
            patient_user, created = User.objects.get_or_create(
                email='paciente@mailyt.dev',
                defaults={'clerk_id': _uid(), 'role': 'PATIENT'},
            )
            if created:
                self.stdout.write(self.style.SUCCESS('  ✓ paciente@mailyt.dev created'))
            patient_profile, _ = PatientProfile.objects.get_or_create(
                user=patient_user,
                defaults={
                    'first_name': 'Ana',
                    'last_name': 'García',
                    'birth_date': date(1990, 5, 14),
                    'sex': 'F',
                    'blood_type': 'O+',
                    'allergies': ['penicilina'],
                    'chronic_conditions': ['diabetes tipo 2', 'hipertensión'],
                    'emergency_contact_name': 'Pedro García',
                    'emergency_contact_phone': '+52 55 1234 5678',
                },
            )

            # ── Patient 2 ──────────────────────────────────────────────────
            patient2_user, created = User.objects.get_or_create(
                email='paciente2@mailyt.dev',
                defaults={'clerk_id': _uid(), 'role': 'PATIENT'},
            )
            if created:
                self.stdout.write(self.style.SUCCESS('  ✓ paciente2@mailyt.dev created'))
            patient2_profile, _ = PatientProfile.objects.get_or_create(
                user=patient2_user,
                defaults={
                    'first_name': 'Luis',
                    'last_name': 'Ramírez',
                    'birth_date': date(1985, 11, 3),
                    'sex': 'M',
                    'blood_type': 'A+',
                    'allergies': [],
                    'chronic_conditions': ['asma'],
                },
            )

            # ── Specialist ─────────────────────────────────────────────────
            spec_user, created = User.objects.get_or_create(
                email='especialista@mailyt.dev',
                defaults={'clerk_id': _uid(), 'role': 'SPECIALIST'},
            )
            if created:
                self.stdout.write(self.style.SUCCESS('  ✓ especialista@mailyt.dev created'))

            # ── Partner ────────────────────────────────────────────────────
            partner_user, created = User.objects.get_or_create(
                email='partner@mailyt.dev',
                defaults={'clerk_id': _uid(), 'role': 'PARTNER'},
            )
            if created:
                self.stdout.write(self.style.SUCCESS('  ✓ partner@mailyt.dev created'))
            PartnerProfile.objects.get_or_create(
                user=partner_user,
                defaults={
                    'business_name': 'Empresa Demo SA de CV',
                    'contact_email': 'partner@mailyt.dev',
                    'description': 'Partner de prueba para desarrollo.',
                },
            )

            # ── Django superuser for admin panel ───────────────────────────
            # Ensure admin can log in to /admin/
            admin.is_staff = True
            admin.is_superuser = True
            admin.set_password('Admin1234!')
            admin.save(update_fields=['is_staff', 'is_superuser', 'password'])

        self.stdout.write('')
        self.stdout.write(self.style.MIGRATE_HEADING('==> Dev seed complete. Postman headers:'))
        self.stdout.write('')
        self.stdout.write('  ADMIN      →  X-Dev-User-Email: admin@mailyt.dev')
        self.stdout.write('  DOCTOR     →  X-Dev-User-Email: doctor@mailyt.dev')
        self.stdout.write('  PACIENTE   →  X-Dev-User-Email: paciente@mailyt.dev')
        self.stdout.write('  PACIENTE2  →  X-Dev-User-Email: paciente2@mailyt.dev')
        self.stdout.write('  SPECIALIST →  X-Dev-User-Email: especialista@mailyt.dev')
        self.stdout.write('  PARTNER    →  X-Dev-User-Email: partner@mailyt.dev')
        self.stdout.write('')
        self.stdout.write('  Admin panel: http://localhost:8000/admin/')
        self.stdout.write('  Login: admin@mailyt.dev / Admin1234!')
        self.stdout.write('')
