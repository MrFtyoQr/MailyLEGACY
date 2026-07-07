"""
Gamification — points, streaks, badges.

Plan multipliers (from architecture):
  FREE      1×
  SILVER    2×
  GOLD      3×
  PLATINUM  5×

Point sources:
  MEDICATION_TAKEN    — cada dosis tomada a tiempo
  VITAL_LOGGED        — signo vital registrado
  LAB_UPLOADED        — resultado de lab subido
  APPOINTMENT_KEPT    — cita completada sin faltar
  STREAK_BONUS        — bonus por racha de N días
  REFERRAL_COMPLETED  — referido a especialista completado
  PROFILE_COMPLETED   — perfil completado al 100%
"""
import uuid
from django.db import models
from django.db.models import Q, UniqueConstraint


class PointSource(models.TextChoices):
    MEDICATION_TAKEN   = 'MEDICATION_TAKEN',   'Medicamento tomado'
    VITAL_LOGGED       = 'VITAL_LOGGED',       'Signo vital registrado'
    LAB_UPLOADED       = 'LAB_UPLOADED',       'Resultado lab subido'
    APPOINTMENT_KEPT   = 'APPOINTMENT_KEPT',   'Cita completada'
    STREAK_BONUS       = 'STREAK_BONUS',       'Bonus por racha'
    REFERRAL_COMPLETED = 'REFERRAL_COMPLETED', 'Referido completado'
    PROFILE_COMPLETED  = 'PROFILE_COMPLETED',  'Perfil completado'
    MANUAL_ADJUSTMENT  = 'MANUAL_ADJUSTMENT',  'Ajuste manual (admin)'


# Base points per action (before multiplier)
BASE_POINTS: dict[str, int] = {
    PointSource.MEDICATION_TAKEN:   10,
    PointSource.VITAL_LOGGED:        5,
    PointSource.LAB_UPLOADED:       15,
    PointSource.APPOINTMENT_KEPT:   20,
    PointSource.STREAK_BONUS:       25,
    PointSource.REFERRAL_COMPLETED: 50,
    PointSource.PROFILE_COMPLETED:  30,
    PointSource.MANUAL_ADJUSTMENT:   0,  # set explicitly
}

PLAN_MULTIPLIERS: dict[str, int] = {
    'FREE':     1,
    'SILVER':   2,
    'GOLD':     3,
    'PLATINUM': 5,
}


class BadgeCategory(models.TextChoices):
    ADHERENCE   = 'ADHERENCE',   'Adherencia'
    VITALS      = 'VITALS',      'Signos vitales'
    STREAK      = 'STREAK',      'Rachas'
    SOCIAL      = 'SOCIAL',      'Social'
    MILESTONE   = 'MILESTONE',   'Hito'


class Badge(models.Model):
    """
    Static badge definition — seeded via migration or management command.
    """
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code        = models.CharField(max_length=50, unique=True,
                                   help_text='Machine-readable key, e.g. STREAK_7')
    name        = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    category    = models.CharField(max_length=12, choices=BadgeCategory.choices)
    icon_url    = models.URLField(max_length=512, blank=True)
    # Threshold that unlocks this badge (semantics depend on category)
    threshold   = models.PositiveIntegerField(
        default=1, help_text='e.g. 7 for STREAK_7 (7-day streak)'
    )
    points_reward = models.PositiveIntegerField(default=0,
                                                help_text='Bonus points awarded on unlock')
    is_active   = models.BooleanField(default=True)

    class Meta:
        ordering = ['category', 'threshold']

    def __str__(self):
        return f'{self.name} ({self.code})'


class PlayerProfile(models.Model):
    """
    Gamification state for a patient — one per PatientProfile.
    Created lazily on first point award.
    """
    id              = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    patient         = models.OneToOneField(
        'accounts.PatientProfile',
        on_delete=models.CASCADE,
        related_name='player_profile',
    )
    total_points    = models.PositiveIntegerField(default=0)
    # Current consecutive days with at least one MEDICATION_TAKEN
    current_streak  = models.PositiveIntegerField(default=0)
    longest_streak  = models.PositiveIntegerField(default=0)
    last_activity_date = models.DateField(null=True, blank=True)
    level           = models.PositiveSmallIntegerField(default=1)

    created_at      = models.DateTimeField(auto_now_add=True)
    updated_at      = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-total_points']

    def __str__(self):
        return f'{self.patient} — {self.total_points}pts (streak {self.current_streak}d)'

    def compute_level(self) -> int:
        """Level thresholds: 1=0, 2=200, 3=500, 4=1000, 5=2000, 6=4000, …"""
        thresholds = [0, 200, 500, 1000, 2000, 4000, 8000, 15000, 30000]
        level = 1
        for i, t in enumerate(thresholds):
            if self.total_points >= t:
                level = i + 1
        return min(level, 10)


class PointTransaction(models.Model):
    """
    Immutable ledger of every point award/deduction.
    The running balance is stored on PlayerProfile.total_points for
    fast access; this table is the authoritative audit trail.
    """
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    player      = models.ForeignKey(
        PlayerProfile, on_delete=models.CASCADE, related_name='transactions'
    )
    source      = models.CharField(max_length=22, choices=PointSource.choices)
    base_points = models.IntegerField(help_text='Points before multiplier')
    multiplier  = models.PositiveSmallIntegerField(default=1)
    points      = models.IntegerField(help_text='Final points (base × multiplier)')
    # Reference to the triggering object (nullable — manual adjustments have none)
    ref_id      = models.CharField(max_length=64, blank=True,
                                   help_text='UUID of the triggering object')
    note        = models.CharField(max_length=255, blank=True)
    created_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at']
        constraints = [
            # Impide puntos duplicados por un mismo evento: un (player, source,
            # ref_id) solo puede otorgarse una vez. La condición excluye los
            # bonos generados por el sistema (STREAK_BONUS, MANUAL_ADJUSTMENT),
            # que no tienen ref_id y pueden repetirse legítimamente.
            UniqueConstraint(
                fields=['player', 'source', 'ref_id'],
                condition=~Q(ref_id=''),
                name='unique_points_per_event',
            ),
        ]

    def save(self, *args, **kwargs):
        if self.pk and PointTransaction.objects.filter(pk=self.pk).exists():
            raise ValueError('PointTransaction records are immutable.')
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.player.patient} +{self.points}pts ({self.source})'


class PlayerBadge(models.Model):
    """
    A badge earned by a player — append-only, no duplicates.
    """
    id         = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    player     = models.ForeignKey(
        PlayerProfile, on_delete=models.CASCADE, related_name='earned_badges'
    )
    badge      = models.ForeignKey(
        Badge, on_delete=models.CASCADE, related_name='player_badges'
    )
    earned_at  = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('player', 'badge')
        ordering        = ['-earned_at']

    def __str__(self):
        return f'{self.player.patient} — {self.badge.name}'


class RewardProduct(models.Model):
    """
    Productos/cupones canjeables por puntos.
    El admin sube la imagen a R2 y guarda la URL aquí.
    La app muestra el catálogo; el canje futuro se implementa en M17 (Coupons).
    """
    id          = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name        = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    image_url   = models.URLField(max_length=512, blank=True,
                                  help_text='URL en R2 — sube la imagen y pega aquí la URL pública.')
    points_cost = models.PositiveIntegerField(help_text='Puntos necesarios para canjear.')
    is_active   = models.BooleanField(default=True)
    stock       = models.PositiveIntegerField(
        default=0, help_text='Unidades disponibles. 0 = ilimitado.'
    )
    created_at  = models.DateTimeField(auto_now_add=True)
    updated_at  = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['points_cost', 'name']

    def __str__(self):
        stock_str = '∞' if self.stock == 0 else str(self.stock)
        return f'{self.name} — {self.points_cost} pts (stock: {stock_str})'
