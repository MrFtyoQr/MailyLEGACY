"""
Partner Portal — corporate clients of CAMSA.

A Partner is a company (employer, insurer, HR department) that:
  1. Signs a corporate agreement with CAMSA.
  2. Enrolls their employees as patients on the platform.
  3. Sees aggregate (anonymized) health statistics for their workforce.
  4. May assign a preferred doctor network for their employees.

Privacy rules:
  - Partners NEVER see individual patient data (names, diagnoses, medications).
  - All metrics exposed are group-level aggregates: adherence %, active
    members, avg vitals by category — minimum cohort of 10 to prevent
    de-anonymization.
  - Patient must explicitly accept the corporate enrollment (consent=True).
"""
import uuid
from django.db import models


class PartnerStatus(models.TextChoices):
    ACTIVE    = 'ACTIVE',    'Activo'
    SUSPENDED = 'SUSPENDED', 'Suspendido'
    CANCELLED = 'CANCELLED', 'Cancelado'


class PartnerOrganization(models.Model):
    """
    A corporate client.  Managed by ADMIN users; one or more PARTNER-role
    users are linked as the organization's administrators.
    """
    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name            = models.CharField(max_length=255)
    rfc             = models.CharField(max_length=13, blank=True,
                                       help_text='RFC (Mexico tax ID)')
    industry        = models.CharField(max_length=100, blank=True)
    logo_url        = models.URLField(max_length=512, blank=True)
    contact_name    = models.CharField(max_length=255, blank=True)
    contact_email   = models.EmailField(blank=True)
    contact_phone   = models.CharField(max_length=20, blank=True)
    address         = models.TextField(blank=True)

    # Subscription / agreement
    status          = models.CharField(
        max_length=10, choices=PartnerStatus.choices, default=PartnerStatus.ACTIVE
    )
    agreement_start = models.DateField(null=True, blank=True)
    agreement_end   = models.DateField(null=True, blank=True)
    # Max seats (employees) included in the agreement
    max_members     = models.PositiveIntegerField(default=100)
    # Monthly fee in MXN
    monthly_fee_mxn = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    # Preferred doctor network — optional
    preferred_doctors = models.ManyToManyField(
        'accounts.DoctorProfile',
        blank=True,
        related_name='partner_organizations',
    )

    created_at      = models.DateTimeField(auto_now_add=True)
    updated_at      = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f'{self.name} ({self.get_status_display()})'


class PartnerAdmin(models.Model):
    """
    Links a PARTNER-role User to an organization as its portal administrator.
    """
    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        PartnerOrganization, on_delete=models.CASCADE, related_name='admins'
    )
    user         = models.ForeignKey(
        'accounts.User', on_delete=models.CASCADE, related_name='partner_roles'
    )
    is_primary   = models.BooleanField(default=False,
                                       help_text='Primary contact for billing/support')
    created_at   = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('organization', 'user')

    def __str__(self):
        return f'{self.user.email} @ {self.organization.name}'


class MemberEnrollment(models.Model):
    """
    An employee enrolled in CAMSA through their employer.

    The patient must accept the enrollment (consent=True) before
    any data — even aggregated — is counted for the partner's dashboard.
    """
    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization = models.ForeignKey(
        PartnerOrganization, on_delete=models.CASCADE, related_name='enrollments'
    )
    patient      = models.ForeignKey(
        'accounts.PatientProfile', on_delete=models.CASCADE, related_name='partner_enrollments'
    )
    # Employee ID as known to the organization (for their HR records)
    employee_id  = models.CharField(max_length=64, blank=True)
    # Patient consent to include their (anonymized) data in company reports
    consent      = models.BooleanField(default=False)
    consent_at   = models.DateTimeField(null=True, blank=True)
    is_active    = models.BooleanField(default=True)
    enrolled_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('organization', 'patient')
        ordering        = ['-enrolled_at']

    def __str__(self):
        return f'{self.patient} → {self.organization.name} (consent={self.consent})'


class PartnerHealthSnapshot(models.Model):
    """
    Weekly aggregated health metrics for a partner organization.
    Computed by a Celery task; stored for trend visualization.
    Only counts enrolled members with consent=True.
    Suppressed if consenting member count < MIN_COHORT (10).
    """
    MIN_COHORT = 10

    id                  = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    organization        = models.ForeignKey(
        PartnerOrganization, on_delete=models.CASCADE, related_name='snapshots'
    )
    period_start        = models.DateField()
    period_end          = models.DateField()
    consenting_members  = models.PositiveIntegerField(default=0)
    active_members      = models.PositiveIntegerField(default=0,
                                                       help_text='Members with ≥1 activity this week')
    avg_adherence_pct   = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    low_adherence_count = models.PositiveIntegerField(default=0,
                                                       help_text='Members with adherence < 70%')
    avg_vitals          = models.JSONField(default=dict, blank=True,
                                           help_text='{"GLUCOSE": 98.2, "WEIGHT": 72.1, ...}')
    created_at          = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('organization', 'period_start')
        ordering        = ['-period_start']

    @property
    def is_suppressed(self):
        """True when cohort is too small to report (privacy protection)."""
        return self.consenting_members < self.MIN_COHORT

    def __str__(self):
        return (f'{self.organization.name} snapshot '
                f'{self.period_start}→{self.period_end} '
                f'(n={self.consenting_members})')
