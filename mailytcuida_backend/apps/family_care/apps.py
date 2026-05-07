from django.apps import AppConfig


class FamilyCareConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.family_care'
    verbose_name = 'Cuidado Familiar'

    def ready(self):
        import apps.family_care.signals  # noqa
