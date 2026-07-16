"""
Recalcula PlayerProfile.level con la nueva tabla de umbrales acumulados.

El nivel pasó de un esquema de umbrales acumulados
[0, 200, 500, 1000, 2000, 4000, 8000, 15000, 30000, 50000]
a costos incrementales por nivel [200, 500, 1000, ...] que, sumados, dan los
umbrales [0, 200, 700, 1700, 3700, 7700, 15700, 30700, 60700, 110700].
El progreso dentro del nivel "inicia en 0" al subir y el excedente se arrastra,
por lo que el nivel sigue siendo función pura de total_points. Los perfiles
existentes tienen su `level` calculado con la tabla anterior y deben corregirse.
Migración de datos únicamente (sin cambios de esquema).
"""
from django.db import migrations

NEW_THRESHOLDS = [0, 200, 700, 1700, 3700, 7700, 15700, 30700, 60700, 110700]
MAX_LEVEL = len(NEW_THRESHOLDS)


def _level_for(total_points):
    level = 1
    for i, t in enumerate(NEW_THRESHOLDS):
        if total_points >= t:
            level = i + 1
    return min(level, MAX_LEVEL)


def recompute_levels(apps, schema_editor):
    PlayerProfile = apps.get_model('gamification', 'PlayerProfile')
    for player in PlayerProfile.objects.all().iterator():
        new_level = _level_for(player.total_points)
        if player.level != new_level:
            player.level = new_level
            player.save(update_fields=['level'])


def noop_reverse(apps, schema_editor):
    # No se puede reconstruir con exactitud el nivel bajo la tabla anterior sin
    # riesgo; la reversión se deja como no-op (los datos siguen siendo válidos).
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('gamification', '0006_seed_default_rewards'),
    ]

    operations = [
        migrations.RunPython(recompute_levels, noop_reverse),
    ]
