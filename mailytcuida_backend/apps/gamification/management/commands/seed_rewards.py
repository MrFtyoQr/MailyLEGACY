"""
management command: python manage.py seed_rewards

Catálogo inicial de cupones canjeables. Seguro ejecutar varias veces (get_or_create por points_cost).
"""
from django.core.management.base import BaseCommand
from apps.gamification.rewards_catalog import DEFAULT_REWARDS, ensure_default_rewards
from apps.gamification.models import RewardProduct


class Command(BaseCommand):
    help = 'Seed del catálogo de cupones canjeables por puntos'

    def handle(self, *args, **options):
        before = RewardProduct.objects.filter(is_active=True).count()
        after = ensure_default_rewards()
        created = max(after - before, 0)
        updated = len(DEFAULT_REWARDS) - created
        self.stdout.write(self.style.SUCCESS(
            f'\nListo: catálogo sincronizado ({after} cupones activos).'
        ))
