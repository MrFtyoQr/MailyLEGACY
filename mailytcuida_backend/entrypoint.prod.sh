#!/bin/sh
set -e

echo "==> Waiting for database..."
until python -c "
import sys, os
import psycopg2
from urllib.parse import urlparse

db_url = os.environ.get('DATABASE_URL', '')
if not db_url:
    print('  ERROR: DATABASE_URL not set', flush=True)
    sys.exit(1)
u = urlparse(db_url)
try:
    psycopg2.connect(
        host=u.hostname,
        port=u.port or 5432,
        user=u.username,
        password=u.password,
        dbname=u.path.lstrip('/'),
    ).close()
    sys.exit(0)
except Exception as e:
    print(f'  waiting: {e}', flush=True)
    sys.exit(1)
" 2>&1; do
  sleep 3
done
echo "==> Database ready."

echo "==> Running migrations..."
python manage.py migrate --noinput

echo "==> Collecting static files..."
python manage.py collectstatic --noinput --clear

echo "==> Seeding badges (idempotent)..."
python manage.py seed_badges || true

echo "==> Seeding reward coupons (idempotent)..."
python manage.py seed_rewards || true

echo "==> Notifying Sentry of deployment start..."
python -c "
import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.production')
django.setup()
import sentry_sdk
sentry_sdk.capture_message('MailyT-Cuida backend: servidor iniciado correctamente', level='info')
" || true

exec "$@"
