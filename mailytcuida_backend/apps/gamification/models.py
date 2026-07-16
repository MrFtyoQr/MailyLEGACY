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
import secrets
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
    REDEMPTION         = 'REDEMPTION',         'Canje de recompensa'


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
    PointSource.REDEMPTION:          0,  # débito real = -points_cost, explícito en el canje
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
    # Experiencia acumulada de por vida: rige el nivel (compute_level) y el
    # leaderboard. Monótono — solo lo incrementan los awards; el canje NO lo
    # toca, de modo que el nivel nunca baja.
    total_points    = models.PositiveIntegerField(default=0)
    # Saldo gastable = puntos ganados − puntos canjeados. Es lo que se debita
    # en POST /redeem/. Se mantiene entre niveles (no se reinicia).
    balance         = models.PositiveIntegerField(
        default=0, help_text='Puntos disponibles para canjear (ganados − canjeados).'
    )
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

    # XP de por vida acumulada necesaria para ALCANZAR cada nivel (1..10).
    # Derivada de los costos incrementales por nivel [200, 500, 1000, 2000,
    # 4000, 8000, 15000, 30000, 50000] mediante sumas parciales. El progreso
    # dentro de un nivel "inicia en 0" y el excedente se arrastra al subir,
    # por lo que el nivel es función pura de total_points (sin campo extra).
    LEVEL_THRESHOLDS = [0, 200, 700, 1700, 3700, 7700, 15700, 30700, 60700, 110700]
    MAX_LEVEL = len(LEVEL_THRESHOLDS)  # 10

    def compute_level(self) -> int:
        """Nivel según la XP de por vida acumulada (total_points)."""
        level = 1
        for i, t in enumerate(self.LEVEL_THRESHOLDS):
            if self.total_points >= t:
                level = i + 1
        return min(level, self.MAX_LEVEL)

    @property
    def level_points(self) -> int:
        """Puntos acumulados dentro del nivel actual (inicia en 0 al subir)."""
        return self.total_points - self.LEVEL_THRESHOLDS[self.compute_level() - 1]

    @property
    def level_points_required(self) -> int:
        """
        Puntos necesarios para completar el nivel actual (costo incremental).
        En el nivel máximo devuelve 0 (no hay siguiente nivel).
        """
        lvl = self.compute_level()
        if lvl >= self.MAX_LEVEL:
            return 0
        return self.LEVEL_THRESHOLDS[lvl] - self.LEVEL_THRESHOLDS[lvl - 1]


class PointTransaction(models.Model):
    """
    Immutable ledger of every point award/deduction; the authoritative
    audit trail. PlayerProfile caches two running totals derived from it:
    total_points (lifetime XP — sum of positive entries; drives level and
    leaderboard) and balance (spendable — sum of all entries, awards minus
    redemptions).
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


def generate_redemption_code() -> str:
    """Código de canje legible: 'RDM-' + 8 hex en mayúsculas (ej. RDM-7F3A9C2B)."""
    return f'RDM-{secrets.token_hex(4).upper()}'


class RedemptionRecord(models.Model):
    """
    Registro de un canje de RewardProduct por puntos.
    El débito de puntos (sobre PlayerProfile.balance), el decremento de stock y
    el enlace al asiento del ledger se realizan atómicamente en
    engine.redeem_reward(), invocado por el endpoint POST /redeem/ (Actividad 6).
    """
    class Status(models.TextChoices):
        PENDING   = 'PENDING',   'Pendiente'
        FULFILLED = 'FULFILLED', 'Entregado'
        CANCELLED = 'CANCELLED', 'Cancelado'

    id           = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    player       = models.ForeignKey(
        PlayerProfile, on_delete=models.CASCADE, related_name='redemptions'
    )
    reward       = models.ForeignKey(
        RewardProduct, on_delete=models.PROTECT, related_name='redemptions'
    )
    # Enlace de trazabilidad al asiento del débito en el ledger. Nullable:
    # el canje se conserva aunque el asiento se elimine (SET_NULL).
    point_transaction = models.ForeignKey(
        'PointTransaction', null=True, blank=True,
        on_delete=models.SET_NULL, related_name='redemption'
    )
    # Snapshot del costo al momento del canje (RewardProduct.points_cost puede cambiar).
    points_spent = models.PositiveIntegerField(help_text='Puntos debitados en el canje.')
    status       = models.CharField(
        max_length=9, choices=Status.choices, default=Status.PENDING
    )
    code         = models.CharField(
        max_length=12, unique=True, default=generate_redemption_code,
        help_text='Código único de canje (ej. RDM-7F3A9C2B).'
    )
    note         = models.CharField(max_length=255, blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.player.patient} — {self.reward.name} ({self.code}, {self.status})'
