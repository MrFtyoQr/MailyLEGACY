#!/bin/sh
set -e

echo "==> Waiting for PostgreSQL..."
until python -c "
import sys, os
import psycopg2
try:
    psycopg2.connect(
        host=os.environ['DB_HOST'],
        port=os.environ.get('DB_PORT', '5432'),
        user=os.environ['DB_USER'],
        password=os.environ['DB_PASSWORD'],
        dbname=os.environ['DB_NAME'],
    ).close()
    sys.exit(0)
except Exception as e:
    print(f'  waiting: {e}', flush=True)
    sys.exit(1)
" 2>&1; do
  sleep 2
done
echo "==> PostgreSQL ready."

echo "==> Running migrations..."
python manage.py migrate --noinput

echo "==> Collecting static files..."
python manage.py collectstatic --noinput --clear

echo "==> Seeding badges (idempotent)..."
python manage.py seed_badges || true

echo "==> Creating dev seed data..."
python manage.py seed_dev_data || true

exec "$@"
