from rest_framework import serializers
from .models import SpecialistProfile, TeamMember, ReferralRequest, SpecialistReview


class SpecialistProfileSerializer(serializers.ModelSerializer):
    specialty_display = serializers.CharField(source='get_specialty_area_display', read_only=True)
    type_display      = serializers.CharField(source='get_specialist_type_display', read_only=True)
    avg_rating        = serializers.SerializerMethodField()
    review_count      = serializers.SerializerMethodField()

    class Meta:
        model  = SpecialistProfile
        fields = [
            'id', 'specialist_type', 'type_display',
            'specialty_area', 'specialty_display',
            'name', 'license_number', 'bio', 'avatar_url',
            'email', 'phone', 'address', 'city', 'state', 'website',
            'consultation_fee_mxn', 'accepts_insurance', 'languages',
            'verification_status', 'verified_at',
            'avg_rating', 'review_count',
            'is_active', 'created_at',
        ]
        read_only_fields = ['id', 'verification_status', 'verified_at', 'created_at']

    def get_avg_rating(self, obj):
        reviews = obj.reviews.filter(is_public=True)
        if not reviews.exists():
            return None
        return round(sum(r.rating for r in reviews) / reviews.count(), 1)

    def get_review_count(self, obj):
        return obj.reviews.filter(is_public=True).count()


class SpecialistProfileCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = SpecialistProfile
        fields = [
            'specialist_type', 'specialty_area', 'name', 'license_number', 'bio',
            'avatar_url', 'email', 'phone', 'address', 'city', 'state', 'website',
            'consultation_fee_mxn', 'accepts_insurance', 'languages',
        ]


class TeamMemberSerializer(serializers.ModelSerializer):
    specialist = SpecialistProfileSerializer(read_only=True)
    specialist_id = serializers.UUIDField(write_only=True)

    class Meta:
        model  = TeamMember
        fields = ['id', 'specialist', 'specialist_id', 'note', 'is_active', 'added_at']
        read_only_fields = ['id', 'added_at']

    def validate_specialist_id(self, value):
        if not SpecialistProfile.objects.filter(pk=value, is_active=True).exists():
            raise serializers.ValidationError('Specialist not found or inactive.')
        return value

    def create(self, validated_data):
        specialist_id = validated_data.pop('specialist_id')
        specialist    = SpecialistProfile.objects.get(pk=specialist_id)
        doctor        = self.context['doctor']
        member, _     = TeamMember.objects.get_or_create(
            doctor=doctor, specialist=specialist,
            defaults={'note': validated_data.get('note', ''), 'is_active': True},
        )
        return member


class ReferralRequestSerializer(serializers.ModelSerializer):
    specialist_name = serializers.CharField(source='specialist.name', read_only=True)
    patient_name    = serializers.SerializerMethodField()
    status_display  = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model  = ReferralRequest
        fields = [
            'id', 'specialist', 'specialist_name',
            'patient', 'patient_name',
            'status', 'status_display',
            'reason', 'urgency', 'clinical_notes', 'specialist_notes',
            'patient_consent', 'appointment',
            'created_at', 'updated_at', 'accepted_at', 'completed_at',
        ]
        read_only_fields = [
            'id', 'status', 'specialist_notes', 'appointment',
            'created_at', 'updated_at', 'accepted_at', 'completed_at',
        ]

    def get_patient_name(self, obj):
        return f'{obj.patient.first_name} {obj.patient.last_name}'


class ReferralCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model  = ReferralRequest
        fields = ['specialist', 'patient', 'reason', 'urgency',
                  'clinical_notes', 'patient_consent']

    def validate(self, data):
        doctor  = self.context['doctor']
        patient = data['patient']
        specialist = data['specialist']

        # Doctor must have this patient assigned
        from apps.accounts.models import DoctorPatient
        if not DoctorPatient.objects.filter(
            doctor=doctor, patient=patient, is_active=True
        ).exists():
            raise serializers.ValidationError(
                'El paciente no está asignado a este médico.'
            )

        # Specialist must be in the doctor's team
        if not TeamMember.objects.filter(
            doctor=doctor, specialist=specialist, is_active=True
        ).exists():
            raise serializers.ValidationError(
                'El especialista no pertenece a tu equipo.'
            )

        # Clinical notes require patient consent
        if data.get('clinical_notes') and not data.get('patient_consent'):
            raise serializers.ValidationError(
                'Se requiere consentimiento del paciente para compartir notas clínicas.'
            )
        return data


class ReferralStatusUpdateSerializer(serializers.Serializer):
    """Used by the specialist to accept/reject a referral."""
    status        = serializers.ChoiceField(choices=['ACCEPTED', 'REJECTED', 'COMPLETED'])
    specialist_notes = serializers.CharField(required=False, allow_blank=True)


class SpecialistReviewSerializer(serializers.ModelSerializer):
    class Meta:
        model  = SpecialistReview
        fields = ['id', 'referral', 'rating', 'comment', 'is_public', 'created_at']
        read_only_fields = ['id', 'created_at']

    def validate_rating(self, value):
        if not (1 <= value <= 5):
            raise serializers.ValidationError('El rating debe ser entre 1 y 5.')
        return value

    def validate_referral(self, referral):
        from .models import ReferralStatus
        if referral.status != ReferralStatus.COMPLETED:
            raise serializers.ValidationError(
                'Solo puedes reseñar referidos completados.'
            )
        if hasattr(referral, 'review'):
            raise serializers.ValidationError(
                'Este referido ya tiene una reseña.'
            )
        return referral
