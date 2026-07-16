"""
Catálogo canónico de cupones canjeables.

Sincronizado con MailyLEGACYapp/src/constants/couponImages.ts (points_cost).
"""
from __future__ import annotations

from .models import RewardProduct

DEFAULT_REWARDS: tuple[dict, ...] = (
    dict(
        name='Cupón 5% OFF',
        description='5% de descuento en productos Aledro Farmaceutic.',
        points_cost=500,
        stock=0,
    ),
    dict(
        name='Cupón 10% OFF',
        description='10% de descuento en tu próxima cita en Clínica CAMSA.',
        points_cost=1000,
        stock=0,
    ),
    dict(
        name='Cupón 15% OFF',
        description='15% de descuento en productos Aledro Farmaceutic.',
        points_cost=1500,
        stock=0,
    ),
    dict(
        name='Cupón 20% OFF',
        description='20% de descuento en tu próxima cita en Clínica CAMSA.',
        points_cost=2000,
        stock=0,
    ),
)


def ensure_default_rewards() -> int:
    """
    Garantiza que el catálogo base exista y esté activo.
    Idempotente — seguro llamar en cada GET /gamification/rewards/.
    Devuelve cuántos productos activos hay tras la sincronización.
    """
    for data in DEFAULT_REWARDS:
        cost = data['points_cost']
        obj, was_created = RewardProduct.objects.get_or_create(
            points_cost=cost,
            defaults={**data, 'is_active': True},
        )
        if not was_created:
            changed = False
            for field in ('name', 'description', 'stock'):
                if getattr(obj, field) != data[field]:
                    setattr(obj, field, data[field])
                    changed = True
            if not obj.is_active:
                obj.is_active = True
                changed = True
            if changed:
                obj.save(update_fields=['name', 'description', 'stock', 'is_active', 'updated_at'])

    return RewardProduct.objects.filter(is_active=True).count()
