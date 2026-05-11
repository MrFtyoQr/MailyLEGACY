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

echo "==> Verifying ASGI application loads correctly..."
python -c "
import sys
try:
    import config.asgi
    print('  ASGI OK — application type:', type(config.asgi.application).__name__, flush=True)
except Exception as e:
    import traceback
    print('  ASGI LOAD FAILED:', flush=True)
    traceback.print_exc()
    sys.exit(1)
"
echo "==> ASGI check passed. Starting Daphne..."

exec "$@"
