"""
management command: python manage.py seed_badges

Seeds the default badge catalog. Safe to run multiple times (uses get_or_create).
"""
from django.core.management.base import BaseCommand
from apps.gamification.models import Badge, BadgeCategory

BADGES = [
    # ── Adherence ──────────────────────────────────────────────────────────
    dict(code='ADHERENCE_1',   name='Primera dosis',         category=BadgeCategory.ADHERENCE,
         description='Tomaste tu primer medicamento.',        threshold=1,   points_reward=20),
    dict(code='ADHERENCE_10',  name='10 dosis cumplidas',    category=BadgeCategory.ADHERENCE,
         description='Has tomado 10 dosis correctamente.',   threshold=10,  points_reward=30),
    dict(code='ADHERENCE_50',  name='50 dosis cumplidas',    category=BadgeCategory.ADHERENCE,
         description='50 dosis sin fallar. ¡Excelente!',     threshold=50,  points_reward=75),
    dict(code='ADHERENCE_100', name='100 dosis cumplidas',   category=BadgeCategory.ADHERENCE,
         description='100 dosis. Eres un ejemplo.',          threshold=100, points_reward=150),
    dict(code='ADHERENCE_500', name='500 dosis cumplidas',   category=BadgeCategory.ADHERENCE,
         description='Dedicación total a tu salud.',         threshold=500, points_reward=500),

    # ── Streaks ────────────────────────────────────────────────────────────
    dict(code='STREAK_7',   name='Racha de 7 días',   category=BadgeCategory.STREAK,
         description='7 días consecutivos tomando tu medicamento.',  threshold=7,  points_reward=50),
    dict(code='STREAK_14',  name='Racha de 14 días',  category=BadgeCategory.STREAK,
         description='2 semanas sin interrupciones.',                threshold=14, points_reward=100),
    dict(code='STREAK_30',  name='Racha de 30 días',  category=BadgeCategory.STREAK,
         description='Un mes de adherencia perfecta.',               threshold=30, points_reward=200),
    dict(code='STREAK_60',  name='Racha de 60 días',  category=BadgeCategory.STREAK,
         description='60 días. Convertiste la salud en hábito.',    threshold=60, points_reward=400),
    dict(code='STREAK_90',  name='Racha de 90 días',  category=BadgeCategory.STREAK,
         description='90 días. Leyenda de la adherencia.',          threshold=90, points_reward=750),

    # ── Vitals ────────────────────────────────────────────────────────────
    dict(code='VITALS_5',  name='Monitor activo',    category=BadgeCategory.VITALS,
         description='Registraste 5 signos vitales.',  threshold=5,  points_reward=25),
    dict(code='VITALS_20', name='Monitor dedicado',  category=BadgeCategory.VITALS,
         description='20 registros de signos vitales.', threshold=20, points_reward=60),
    dict(code='VITALS_50', name='Monitor experto',   category=BadgeCategory.VITALS,
         description='50 registros. Conoces tu cuerpo.', threshold=50, points_reward=120),

    # ── Milestones ─────────────────────────────────────────────────────────
    dict(code='POINTS_500',   name='500 puntos',    category=BadgeCategory.MILESTONE,
         description='Alcanzaste 500 puntos.',      threshold=500,   points_reward=0),
    dict(code='POINTS_1000',  name='1,000 puntos',  category=BadgeCategory.MILESTONE,
         description='1,000 puntos acumulados.',    threshold=1000,  points_reward=0),
    dict(code='POINTS_5000',  name='5,000 puntos',  category=BadgeCategory.MILESTONE,
         description='5,000 puntos. Nivel élite.',  threshold=5000,  points_reward=0),
    dict(code='POINTS_10000', name='10,000 puntos', category=BadgeCategory.MILESTONE,
         description='10,000 puntos. Leyenda.',     threshold=10000, points_reward=0),

    # ── Social ────────────────────────────────────────────────────────────
    dict(code='REFERRAL_1', name='Primer especialista',  category=BadgeCategory.SOCIAL,
         description='Completaste tu primera consulta con un especialista.',
         threshold=1, points_reward=50),
    dict(code='REFERRAL_5', name='Red de especialistas', category=BadgeCategory.SOCIAL,
         description='5 consultas con especialistas completadas.',
         threshold=5, points_reward=150),
]


class Command(BaseCommand):
    help = 'Seed the default badge catalog'

    def handle(self, *args, **options):
        created = 0
        for data in BADGES:
            _, is_new = Badge.objects.get_or_create(
                code=data['code'],
                defaults={k: v for k, v in data.items() if k != 'code'},
            )
            if is_new:
                created += 1

        self.stdout.write(
            self.style.SUCCESS(
                f'Badge catalog seeded: {created} new / {len(BADGES) - created} already existed.'
            )
        )
