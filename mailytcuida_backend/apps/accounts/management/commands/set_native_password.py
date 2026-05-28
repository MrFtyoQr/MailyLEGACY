"""
Comando de gestión: set_native_password

Establece una contraseña usable para un usuario existente (migrado de Clerk).
Útil para la primera vez que se ejecuta el nuevo sistema de auth.

Uso:
    python manage.py set_native_password admin@mailyt.dev "MiNuevaContra123!"
    python manage.py set_native_password admin@mailyt.dev  # pide la contraseña interactivamente
"""

import getpass
from django.core.management.base import BaseCommand, CommandError
from apps.accounts.models import User


class Command(BaseCommand):
    help = 'Establece contraseña nativa para un usuario existente (migración desde Clerk).'

    def add_arguments(self, parser):
        parser.add_argument('email', type=str, help='Email del usuario')
        parser.add_argument(
            'password', nargs='?', type=str,
            help='Nueva contraseña (si se omite, se pide interactivamente)',
        )
        parser.add_argument(
            '--staff', action='store_true',
            help='Marcar al usuario como is_staff=True (acceso al admin de Django)',
        )
        parser.add_argument(
            '--superuser', action='store_true',
            help='Marcar al usuario como is_superuser=True',
        )

    def handle(self, *args, **options):
        email    = options['email'].strip().lower()
        password = options.get('password')

        try:
            user = User.objects.get(email=email)
        except User.DoesNotExist:
            raise CommandError(f'No existe ningún usuario con email: {email}')

        if not password:
            password = getpass.getpass(f'Nueva contraseña para {email}: ')
            confirm  = getpass.getpass('Confirmar contraseña: ')
            if password != confirm:
                raise CommandError('Las contraseñas no coinciden.')

        if len(password) < 8:
            raise CommandError('La contraseña debe tener al menos 8 caracteres.')

        user.set_password(password)
        update_fields = ['password']

        if options['staff']:
            user.is_staff = True
            update_fields.append('is_staff')

        if options['superuser']:
            user.is_superuser = True
            update_fields.append('is_superuser')

        user.save(update_fields=update_fields)
        self.stdout.write(self.style.SUCCESS(
            f'✅ Contraseña establecida para {email} (rol={user.role})'
        ))

        if not user.is_staff:
            self.stdout.write(self.style.WARNING(
                '  ⚠️  Este usuario no tiene is_staff=True. '
                'Para acceso al Django admin, usa --staff.'
            ))
