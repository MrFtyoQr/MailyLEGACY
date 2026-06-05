from rest_framework import serializers
from core.serializers.sanitize import SanitizedOutputMixin
from .models import User, PatientProfile, DoctorProfile, DoctorPatient, SpecialistProfile, PartnerProfile


# ── Paciente ──────────────────────────────────────────────────────────────────

class PatientProfileSerializer(SanitizedOutputMixin, serializers.ModelSerializer):
    class Meta:
        model = PatientProfile
        fields = [
            'id', 'first_name', 'last_name', 'birth_date', 'sex',
            'blood_type', 'allergies', 'chronic_conditions',
            'emergency_contact_name', 'emergency_contact_phone',
            'photo_url', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'photo_url', 'created_at', 'updated_at']

    def validate_allergies(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError('Debe ser una lista.')
        return value

    def validate_chronic_conditions(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError('Debe ser una lista.')
        return value

    def validate_blood_type(self, value):
        valid = {'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', ''}
        if value not in valid:
            raise serializers.ValidationError('Tipo de sangre inválido.')
        return value


class PatientProfilePublicSerializer(serializers.ModelSerializer):
    """Vista reducida del paciente para el doctor (sin datos ultra-sensibles)."""
    email = serializers.EmailField(source='user.email', read_only=True)
    phone = serializers.CharField(source='user.phone', read_only=True)

    class Meta:
        model = PatientProfile
        fields = [
            'id', 'first_name', 'last_name', 'birth_date', 'sex',
            'blood_type', 'allergies', 'chronic_conditions',
            'emergency_contact_name', 'emergency_contact_phone',
            'photo_url', 'email', 'phone',
        ]
        read_only_fields = fields


# ── Doctor ────────────────────────────────────────────────────────────────────

class DoctorProfileSerializer(SanitizedOutputMixin, serializers.ModelSerializer):
    class Meta:
        model = DoctorProfile
        fields = [
            'id', 'first_name', 'last_name', 'license_number',
            'specialty', 'hospital', 'photo_url', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'photo_url', 'created_at', 'updated_at']

    def validate_license_number(self, value):
        if len(value) < 4:
            raise serializers.ValidationError('Cédula profesional muy corta.')
        return value


# ── Especialista ──────────────────────────────────────────────────────────────

class SpecialistProfileSerializer(SanitizedOutputMixin, serializers.ModelSerializer):
    class Meta:
        model = SpecialistProfile
        fields = [
            'id', 'first_name', 'last_name', 'specialty_type',
            'license_number', 'bio', 'photo_url', 'is_available',
            'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'photo_url', 'created_at', 'updated_at']


# ── Partner ───────────────────────────────────────────────────────────────────

class PartnerProfileSerializer(SanitizedOutputMixin, serializers.ModelSerializer):
    class Meta:
        model = PartnerProfile
        fields = [
            'id', 'business_name', 'contact_email', 'logo_url',
            'website_url', 'description', 'is_active', 'created_at', 'updated_at',
        ]
        read_only_fields = ['id', 'logo_url', 'created_at', 'updated_at']


# ── Relación doctor-paciente ──────────────────────────────────────────────────

class DoctorPatientSerializer(serializers.ModelSerializer):
    patient = PatientProfilePublicSerializer(read_only=True)
    patient_email = serializers.EmailField(write_only=True)

    class Meta:
        model = DoctorPatient
        fields = ['id', 'patient', 'patient_email', 'assigned_at', 'is_active', 'notes']
        read_only_fields = ['id', 'patient', 'assigned_at', 'is_active']

    def validate_patient_email(self, value):
        try:
            patient_user = User.objects.get(email=value, role=User.Role.PATIENT, is_active=True)
        except User.DoesNotExist:
            raise serializers.ValidationError('No existe un paciente activo con ese email.')
        try:
            self._patient_profile = patient_user.patient_profile
        except PatientProfile.DoesNotExist:
            raise serializers.ValidationError('El paciente aún no tiene perfil completado.')
        return value

    def create(self, validated_data):
        validated_data.pop('patient_email')
        doctor_profile = self.context['request'].user.doctor_profile
        assignment, created = DoctorPatient.objects.get_or_create(
            doctor=doctor_profile,
            patient=self._patient_profile,
            defaults={'notes': validated_data.get('notes', ''), 'is_active': True},
        )
        if not created:
            assignment.is_active = True
            assignment.save(update_fields=['is_active'])
        return assignment


# ── Me (usuario autenticado completo) ────────────────────────────────────────

class MeSerializer(serializers.ModelSerializer):
    patient_profile    = PatientProfileSerializer(read_only=True)
    doctor_profile     = DoctorProfileSerializer(read_only=True)
    specialist_profile = SpecialistProfileSerializer(read_only=True)
    partner_profile    = PartnerProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'clerk_id', 'email', 'phone', 'role',
            'is_active', 'created_at', 'updated_at',
            'patient_profile', 'doctor_profile',
            'specialist_profile', 'partner_profile',
        ]
        read_only_fields = ['id', 'clerk_id', 'role', 'created_at', 'updated_at']


# ── Admin — lista de usuarios (enriquecido) ───────────────────────────────────

class UserAdminSerializer(serializers.ModelSerializer):
    first_name  = serializers.SerializerMethodField()
    last_name   = serializers.SerializerMethodField()
    photo_url   = serializers.SerializerMethodField()
    birth_date  = serializers.SerializerMethodField()
    plan_tier   = serializers.SerializerMethodField()
    plan_name   = serializers.SerializerMethodField()
    vital_count = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            'id', 'email', 'phone', 'role', 'is_active', 'created_at',
            'first_name', 'last_name', 'photo_url', 'birth_date',
            'plan_tier', 'plan_name', 'vital_count',
        ]
        read_only_fields = fields

    def _profile(self, obj):
        return getattr(obj, 'patient_profile', None)

    def get_first_name(self, obj):
        p = self._profile(obj); return getattr(p, 'first_name', '') or ''

    def get_last_name(self, obj):
        p = self._profile(obj); return getattr(p, 'last_name', '') or ''

    def get_photo_url(self, obj):
        p = self._profile(obj); return getattr(p, 'photo_url', None)

    def get_birth_date(self, obj):
        p = self._profile(obj)
        bd = getattr(p, 'birth_date', None)
        return bd.isoformat() if bd else None

    def get_plan_tier(self, obj):
        try:
            return obj.subscription.plan.tier
        except Exception:
            return 'FREE'

    def get_plan_name(self, obj):
        try:
            return obj.subscription.plan.name
        except Exception:
            return 'Plan Gratuito'

    def get_vital_count(self, obj):
        try:
            return obj.patient_profile.vital_signs.count()
        except Exception:
            return 0


# ── Upload foto ───────────────────────────────────────────────────────────────

class PhotoUploadSerializer(serializers.Serializer):
    photo = serializers.ImageField()

    def validate_photo(self, value):
        max_mb = 5
        if value.size > max_mb * 1024 * 1024:
            raise serializers.ValidationError(f'La imagen no puede superar {max_mb} MB.')
        allowed = {'image/jpeg', 'image/png', 'image/webp'}
        if value.content_type not in allowed:
            raise serializers.ValidationError('Solo se permiten JPEG, PNG o WebP.')
        return value
