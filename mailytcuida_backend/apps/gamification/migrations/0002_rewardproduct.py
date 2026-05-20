import uuid
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('gamification', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='RewardProduct',
            fields=[
                ('id',          models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, serialize=False)),
                ('name',        models.CharField(max_length=150)),
                ('description', models.TextField(blank=True)),
                ('image_url',   models.URLField(blank=True, max_length=512,
                                                help_text='URL en R2 — sube la imagen y pega aquí la URL pública.')),
                ('points_cost', models.PositiveIntegerField(help_text='Puntos necesarios para canjear.')),
                ('is_active',   models.BooleanField(default=True)),
                ('stock',       models.PositiveIntegerField(default=0,
                                                            help_text='Unidades disponibles. 0 = ilimitado.')),
                ('created_at',  models.DateTimeField(auto_now_add=True)),
                ('updated_at',  models.DateTimeField(auto_now=True)),
            ],
            options={
                'ordering': ['points_cost', 'name'],
            },
        ),
    ]
