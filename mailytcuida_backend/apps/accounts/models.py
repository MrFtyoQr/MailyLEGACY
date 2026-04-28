import uuid
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models
from django.utils import timezone


class UserManager(BaseUserManager):
    def create_user(self, email, clerk_id, role='PATIENT', **extra_fields):
        if not email:
            raise ValueError('Email requerido')
        email = self.normalize_email(email)
        user = self.model(email=email, clerk_id=clerk_id, role=role, **extra_fields)
        user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, email, clerk_id, **extra_fields):
        extra_fields.setdefault('role', 'ADMIN')
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(email, clerk_id, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    class Role(models.TextChoices):
        PATIENT    = 'PATIENT',    'Paciente'
        DOCTOR     = 'DOCTOR',     'Doctor'
        SPECIALIST = 'SPECIALIST', 'Especialista'
        PARTNER    = 'PARTNER',    'Partner externo'
        ADMIN      = 'ADMIN',      'Administrador'

    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    clerk_id   = models.CharField(max_length=255, unique=True, db_index=True)
    email      = models.EmailField(unique=True)
    phone      = models.CharField(max_length=20, blank=True)
    role       = models.CharField(max_length=20, choices=Role.choices, default=Role.PATIENT)
    is_active  = models.BooleanField(default=True)
    is_staff   = models.BooleanField(default=False)
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    objects = UserManager()

    USERNAME_FIELD  = 'email'
    REQUIRED_FIELDS = ['clerk_id']

    class Meta:
        db_table = 'accounts_user'
        verbose_name = 'Usuario'
        verbose_name_plural = 'Usuarios'

    def __str__(self):
        return f'{self.email} ({self.role})'


class PatientProfile(models.Model):
    class Sex(models.TextChoices):
        MALE   = 'M',     'Masculino'
        FEMALE = 'F',     'Femenino'
        OTHER  = 'OTHER', 'Otro'

    id                      = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user                    = models.OneToOneField(User, on_delete=models.CASCADE, related_name='patient_profile')
    first_name              = models.CharField(max_length=100)
    last_name               = models.CharField(max_length=100)
    birth_date              = models.DateField(null=True, blank=True)
    sex                     = models.CharField(max_length=10, choices=Sex.choices, blank=True)
    blood_type              = models.CharField(max_length=5, blank=True)
    allergies               = models.JSONField(default=list, blank=True)
    chronic_conditions      = models.JSONField(default=list, blank=True)
    emergency_contact_name  = models.CharField(max_length=200, blank=True)
    emergency_contact_phone = models.CharField(max_length=20, blank=True)
    photo_url               = models.URLField(max_length=500, blank=True)
    created_at              = models.DateTimeField(auto_now_add=True)
    updated_at              = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'accounts_patient_profile'
        verbose_name = 'Perfil de paciente'

    def __str__(self):
        return f'{self.first_name} {self.last_name}'


class DoctorProfile(models.Model):
    id             = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user           = models.OneToOneField(User, on_delete=models.CASCADE, related_name='doctor_profile')
    first_name     = models.CharField(max_length=100)
    last_name      = models.CharField(max_length=100)
    license_number = models.CharField(max_length=100, unique=True)
    specialty      = models.CharField(max_length=100, blank=True)
    hospital       = models.CharField(max_length=200, blank=True)
    photo_url      = models.URLField(max_length=500, blank=True)
    created_at     = models.DateTimeField(auto_now_add=True)
    updated_at     = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'accounts_doctor_profile'
        verbose_name = 'Perfil de doctor'

    def __str__(self):
        return f'Dr. {self.first_name} {self.last_name}'


class DoctorPatient(models.Model):
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    doctor      = models.ForeignKey(DoctorProfile, on_delete=models.CASCADE, related_name='patient_assignments')
    patient     = models.ForeignKey(PatientProfile, on_delete=models.CASCADE, related_name='doctor_assignments')
    assigned_at = models.DateTimeField(auto_now_add=True)
    is_active   = models.BooleanField(default=True)
    notes       = models.TextField(blank=True)

    class Meta:
        db_table = 'accounts_doctor_patient'
        unique_together = ('doctor', 'patient')
        verbose_name = 'Asignación doctor-paciente'


class SpecialistProfile(models.Model):
    class SpecialtyType(models.TextChoices):
        NUTRITIONIST    = 'NUTRITIONIST',    'Nutriólogo'
        PHYSIOTHERAPIST = 'PHYSIOTHERAPIST', 'Fisioterapeuta'
        OTHER           = 'OTHER',           'Otro'

    id             = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user           = models.OneToOneField(User, on_delete=models.CASCADE, related_name='specialist_profile')
    first_name     = models.CharField(max_length=100)
    last_name      = models.CharField(max_length=100)
    specialty_type = models.CharField(max_length=20, choices=SpecialtyType.choices, default=SpecialtyType.OTHER)
    license_number = models.CharField(max_length=100, blank=True)
    bio            = models.TextField(blank=True)
    photo_url      = models.URLField(max_length=500, blank=True)
    is_available   = models.BooleanField(default=True)
    created_at     = models.DateTimeField(auto_now_add=True)
    updated_at     = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'accounts_specialist_profile'
        verbose_name = 'Perfil de especialista'

    def __str__(self):
        return f'{self.get_specialty_type_display()}: {self.first_name} {self.last_name}'


class PartnerProfile(models.Model):
    id            = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user          = models.OneToOneField(User, on_delete=models.CASCADE, related_name='partner_profile')
    business_name = models.CharField(max_length=200)
    contact_email = models.EmailField()
    logo_url      = models.URLField(max_length=500, blank=True)
    website_url   = models.URLField(max_length=500, blank=True)
    description   = models.TextField(blank=True)
    is_active     = models.BooleanField(default=True)
    created_at    = models.DateTimeField(auto_now_add=True)
    updated_at    = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'accounts_partner_profile'
        verbose_name = 'Perfil de partner'

    def __str__(self):
        return self.business_name
