FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DJANGO_SETTINGS_MODULE=config.settings.production

WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Python deps (production only — no debug toolbar, no ipython)
COPY requirements/base.txt requirements/base.txt
COPY requirements/production.txt requirements/production.txt
RUN pip install --no-cache-dir -r requirements/production.txt

COPY . .

COPY entrypoint.prod.sh /entrypoint.prod.sh
RUN chmod +x /entrypoint.prod.sh

EXPOSE 8080

ENTRYPOINT ["/entrypoint.prod.sh"]

# Daphne = ASGI server con soporte WebSocket (Django Channels)
# Sevalla routes to port 8080 by default
CMD ["daphne", "-b", "0.0.0.0", "-p", "8080", "config.asgi:application"]
