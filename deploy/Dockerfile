# syntax=docker/dockerfile:1
# Kontekst — loyiha ildizi:  docker compose -f deploy/docker-compose.yml build
# Targetlar: `app` (Django: gunicorn / daphne / migrate / scheduler / bot) va `nginx` (statik + proksi).

# ── 1. Frontend build (Node faqat shu bosqichda — tayyor image'da yo'q) ──────────
FROM node:22-alpine AS frontend
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY frontend/ ./
RUN npx vite build

# ── 2. Django ──────────────────────────────────────────────────────────────────
FROM python:3.14-slim AS app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /app/backend
COPY backend/requirements.txt .
RUN pip install -r requirements.txt
COPY backend/ .
COPY --from=frontend /src/frontend/dist /app/frontend/dist
# Statik fayllar (frontend build + admin) bir joyga — ularni Nginx beradi
RUN DJANGO_DEBUG=0 DJANGO_SECRET_KEY=build-only python manage.py collectstatic --noinput \
    && useradd --uid 1000 --no-create-home --shell /usr/sbin/nologin app \
    && mkdir -p media && chown app:app media
USER app

# ── 3. Nginx: statik fayllar image ichida, qolgani proksi ────────────────────────
FROM nginx:1.29-alpine AS nginx
COPY deploy/nginx.conf /etc/nginx/nginx.conf
COPY --from=app /app/backend/staticfiles /srv/static
