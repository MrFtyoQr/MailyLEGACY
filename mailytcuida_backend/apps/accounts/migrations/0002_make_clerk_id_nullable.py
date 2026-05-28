from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Hace clerk_id opcional (null=True, blank=True) para soportar usuarios
    nativos (sin Clerk). Los usuarios existentes conservan su clerk_id.
    """

    dependencies = [
        ('accounts', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='user',
            name='clerk_id',
            field=models.CharField(
                blank=True,
                db_index=True,
                max_length=255,
                null=True,
                unique=True,
            ),
        ),
    ]
