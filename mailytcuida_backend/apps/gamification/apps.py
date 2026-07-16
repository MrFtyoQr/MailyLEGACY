from django.apps import AppConfig


class GamificationConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.gamification'
    verbose_name = 'Gamification'

    def ready(self):
        import apps.gamification.signals  # noqa: F401

        from django.db.models.signals import post_migrate

        def seed_default_rewards(sender, **kwargs):
            if sender.name != self.name:
                return
            try:
                from .rewards_catalog import ensure_default_rewards
                ensure_default_rewards()
            except Exception:
                pass

        post_migrate.connect(seed_default_rewards, sender=self)
