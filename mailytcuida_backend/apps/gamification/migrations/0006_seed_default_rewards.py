"""Auto-sembrar cupones canjeables al migrar (sin comando manual)."""

from django.db import migrations


def seed_rewards(apps, schema_editor):
    RewardProduct = apps.get_model('gamification', 'RewardProduct')
    catalog = (
        dict(name='Cupón 5% OFF',  description='5% de descuento en productos Aledro Farmaceutic.',  points_cost=500,  stock=0),
        dict(name='Cupón 10% OFF', description='10% de descuento en tu próxima cita en Clínica CAMSA.', points_cost=1000, stock=0),
        dict(name='Cupón 15% OFF', description='15% de descuento en productos Aledro Farmaceutic.',  points_cost=1500, stock=0),
        dict(name='Cupón 20% OFF', description='20% de descuento en tu próxima cita en Clínica CAMSA.', points_cost=2000, stock=0),
    )
    for data in catalog:
        obj, created = RewardProduct.objects.get_or_create(
            points_cost=data['points_cost'],
            defaults={**data, 'is_active': True},
        )
        if not created:
            for field in ('name', 'description', 'stock'):
                setattr(obj, field, data[field])
            obj.is_active = True
            obj.save(update_fields=['name', 'description', 'stock', 'is_active', 'updated_at'])


class Migration(migrations.Migration):

    dependencies = [
        ('gamification', '0005_playerprofile_balance_and_more'),
    ]

    operations = [
        migrations.RunPython(seed_rewards, migrations.RunPython.noop),
    ]
