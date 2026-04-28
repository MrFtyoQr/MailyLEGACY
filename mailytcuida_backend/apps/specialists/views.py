"""
Specialists API.

Public / patient browsing:
  GET  /api/v1/specialists/                          — browse verified specialists
  GET  /api/v1/specialists/<id>/                     — specialist detail + reviews

Doctor — manage their team:
  GET  /api/v1/specialists/team/                     — my team list
  POST /api/v1/specialists/team/                     — add specialist to team
  DELETE /api/v1/specialists/team/<id>/              — remove from team (soft)

  POST /api/v1/specialists/register/                 — doctor registers a new specialist profile

Doctor — referrals:
  GET  /api/v1/specialists/referrals/                — referrals sent by this doctor
  POST /api/v1/specialists/referrals/                — create referral for a patient
  GET  /api/v1/specialists/referrals/<id>/           — referral detail

Specialist — incoming referrals:
  GET  /api/v1/specialists/referrals/incoming/       — referrals sent TO this specialist
  PATCH /api/v1/specialists/referrals/<id>/status/   — accept / reject / complete

Patient — referrals:
  GET  /api/v1/specialists/referrals/mine/           — my referrals as patient
  POST /api/v1/specialists/referrals/<id>/consent/   — grant/revoke clinical notes consent

Reviews:
  GET  /api/v1/specialists/<id>/reviews/             — public reviews for a specialist
  POST /api/v1/specialists/referrals/<id>/review/    — patient submits review
"""
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import generics, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.accounts.models import DoctorProfile, PatientProfile
from .models import (
    SpecialistProfile, TeamMember, ReferralRequest,
    SpecialistReview, ReferralStatus, VerificationStatus,
)
from .serializers import (
    SpecialistProfileSerializer, SpecialistProfileCreateSerializer,
    TeamMemberSerializer, ReferralRequestSerializer,
    ReferralCreateSerializer, ReferralStatusUpdateSerializer,
    SpecialistReviewSerializer,
)


def _get_doctor(request):
    return get_object_or_404(DoctorProfile, user=request.user)


def _get_patient(request):
    return get_object_or_404(PatientProfile, user=request.user)


def _get_specialist_profile(request):
    return get_object_or_404(SpecialistProfile, user=request.user, is_active=True)


# ── Public / patient: browse specialists ──────────────────────────────────────

class SpecialistListView(generics.ListAPIView):
    """Verified specialists — browsable by any authenticated user."""
    permission_classes = [IsAuthenticated]
    serializer_class   = SpecialistProfileSerializer

    def get_queryset(self):
        qs      = SpecialistProfile.objects.filter(
            is_active=True, verification_status=VerificationStatus.VERIFIED
        )
        params  = self.request.query_params
        area    = params.get('specialty_area')
        sp_type = params.get('specialist_type')
        city    = params.get('city')
        search  = params.get('q')

        if area:
            qs = qs.filter(specialty_area=area)
        if sp_type:
            qs = qs.filter(specialist_type=sp_type)
        if city:
            qs = qs.filter(city__icontains=city)
        if search:
            qs = qs.filter(name__icontains=search)
        return qs


class SpecialistDetailView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class   = SpecialistProfileSerializer
    queryset           = SpecialistProfile.objects.filter(is_active=True)


# ── Doctor: register a new specialist ────────────────────────────────────────

class SpecialistRegisterView(APIView):
    """
    Doctor registers an external professional into the platform.
    The new profile starts as PENDING verification (ADMIN reviews it).
    The doctor is automatically added as the first team member.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        doctor = _get_doctor(request)
        ser    = SpecialistProfileCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        specialist = ser.save()
        # Auto-add to doctor's team
        TeamMember.objects.create(doctor=doctor, specialist=specialist)
        return Response(
            SpecialistProfileSerializer(specialist).data,
            status=status.HTTP_201_CREATED,
        )


# ── Doctor: team management ───────────────────────────────────────────────────

class TeamMemberListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        doctor  = _get_doctor(request)
        members = TeamMember.objects.filter(
            doctor=doctor, is_active=True
        ).select_related('specialist')
        return Response(TeamMemberSerializer(members, many=True).data)

    def post(self, request):
        doctor = _get_doctor(request)
        ser    = TeamMemberSerializer(
            data=request.data, context={'doctor': doctor}
        )
        ser.is_valid(raise_exception=True)
        member = ser.save()
        return Response(TeamMemberSerializer(member).data, status=status.HTTP_201_CREATED)


class TeamMemberRemoveView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        doctor = _get_doctor(request)
        member = get_object_or_404(TeamMember, pk=pk, doctor=doctor, is_active=True)
        member.is_active = False
        member.save(update_fields=['is_active'])
        return Response(status=status.HTTP_204_NO_CONTENT)


# ── Doctor: send referral ─────────────────────────────────────────────────────

class ReferralListCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        doctor    = _get_doctor(request)
        referrals = ReferralRequest.objects.filter(doctor=doctor).select_related(
            'specialist', 'patient'
        )
        return Response(ReferralRequestSerializer(referrals, many=True).data)

    def post(self, request):
        doctor = _get_doctor(request)
        ser    = ReferralCreateSerializer(
            data=request.data, context={'doctor': doctor}
        )
        ser.is_valid(raise_exception=True)
        referral = ser.save(doctor=doctor)

        # Notify specialist if they have a platform account
        try:
            if referral.specialist.user:
                from apps.notifications.service import notify
                notify(
                    user    = referral.specialist.user,
                    code    = 'REFERRAL_RECEIVED',
                    context = {
                        'doctor_name':   f'Dr. {doctor.first_name} {doctor.last_name}',
                        'patient_name':  f'{referral.patient.first_name} {referral.patient.last_name}',
                        'urgency':       referral.urgency,
                    },
                    channel = 'PUSH',
                )
        except Exception:
            pass

        return Response(
            ReferralRequestSerializer(referral).data,
            status=status.HTTP_201_CREATED,
        )


class ReferralDetailView(generics.RetrieveAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class   = ReferralRequestSerializer

    def get_object(self):
        user = self.request.user
        role = getattr(user, 'role', '')
        pk   = self.kwargs['pk']

        if role == 'DOCTOR':
            doctor = _get_doctor(self.request)
            return get_object_or_404(ReferralRequest, pk=pk, doctor=doctor)
        if role == 'PATIENT':
            patient = _get_patient(self.request)
            return get_object_or_404(ReferralRequest, pk=pk, patient=patient)
        if role == 'SPECIALIST':
            sp = _get_specialist_profile(self.request)
            return get_object_or_404(ReferralRequest, pk=pk, specialist=sp)
        from rest_framework.exceptions import PermissionDenied
        raise PermissionDenied()


# ── Specialist: manage incoming referrals ─────────────────────────────────────

class IncomingReferralListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class   = ReferralRequestSerializer

    def get_queryset(self):
        sp = _get_specialist_profile(self.request)
        status_filter = self.request.query_params.get('status')
        qs = ReferralRequest.objects.filter(specialist=sp).select_related('patient', 'doctor')
        if status_filter:
            qs = qs.filter(status=status_filter)
        return qs


class ReferralStatusUpdateView(APIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        sp       = _get_specialist_profile(request)
        referral = get_object_or_404(ReferralRequest, pk=pk, specialist=sp)
        ser      = ReferralStatusUpdateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        new_status = ser.validated_data['status']
        notes      = ser.validated_data.get('specialist_notes', '')

        if new_status == 'ACCEPTED':
            referral.accepted_at = timezone.now()
        elif new_status == 'COMPLETED':
            referral.completed_at = timezone.now()

        referral.status           = new_status
        referral.specialist_notes = notes or referral.specialist_notes
        referral.save(update_fields=['status', 'specialist_notes', 'accepted_at', 'completed_at'])

        # Notify the referring doctor
        try:
            from apps.notifications.service import notify
            notify(
                user    = referral.doctor.user,
                code    = 'REFERRAL_STATUS_CHANGED',
                context = {
                    'specialist_name': sp.name,
                    'patient_name':    f'{referral.patient.first_name} {referral.patient.last_name}',
                    'new_status':      referral.get_status_display(),
                },
                channel = 'PUSH',
            )
        except Exception:
            pass

        return Response(ReferralRequestSerializer(referral).data)


# ── Patient: my referrals ─────────────────────────────────────────────────────

class PatientReferralListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class   = ReferralRequestSerializer

    def get_queryset(self):
        patient = _get_patient(self.request)
        return ReferralRequest.objects.filter(patient=patient).select_related(
            'specialist', 'doctor'
        )


class ReferralConsentView(APIView):
    """Patient grants or revokes consent to share clinical notes with specialist."""
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        patient  = _get_patient(request)
        referral = get_object_or_404(ReferralRequest, pk=pk, patient=patient)
        consent  = request.data.get('patient_consent')
        if consent is None:
            return Response(
                {'detail': 'patient_consent (bool) is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        referral.patient_consent = bool(consent)
        referral.save(update_fields=['patient_consent'])
        return Response({'patient_consent': referral.patient_consent})


# ── Reviews ───────────────────────────────────────────────────────────────────

class SpecialistReviewListView(generics.ListAPIView):
    permission_classes = [IsAuthenticated]
    serializer_class   = SpecialistReviewSerializer

    def get_queryset(self):
        specialist = get_object_or_404(SpecialistProfile, pk=self.kwargs['pk'])
        return SpecialistReview.objects.filter(specialist=specialist, is_public=True)


class ReferralReviewCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        patient  = _get_patient(request)
        referral = get_object_or_404(
            ReferralRequest, pk=pk, patient=patient, status=ReferralStatus.COMPLETED
        )
        ser = SpecialistReviewSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        review = ser.save(
            patient    = patient,
            specialist = referral.specialist,
            referral   = referral,
        )
        return Response(SpecialistReviewSerializer(review).data, status=status.HTTP_201_CREATED)
