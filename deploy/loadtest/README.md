# Yuk testi (Locust) — faqat sinov stendida

Soxta 10 000 dasturchi yaratadi va har birini haqiqiy xodim kabi ishlatadi: login → WebSocket ochiq turadi →
har 10–30 soniyada bitta amal (bosh panel, vazifalar, vazifa oynasi, bildirishnomalar, chat, qidiruv).
**Amaldagi bazada ishga tushirmang** — `seed` faqat `TEAMFLOW_LOADTEST=1` bilan ishlaydi.

## Ishga tushirish

```bash
# 1) Sinov stendi (alohida loyiha nomi bilan — prod konteynerlariga tegmaydi)
cp deploy/.env.example deploy/.env    # DJANGO_HTTPS=0, DJANGO_ALLOWED_HOSTS=nginx,localhost, HTTP_PORT=8080
docker compose -p tfscale -f deploy/docker-compose.yml up -d --build

# 2) Soxta ma'lumot: 10 000 dasturchi, 50 000 vazifa, 200 000 bildirishnoma, 50 000 chat xabari (6 oyga taqsimlangan)
docker compose -p tfscale -f deploy/docker-compose.yml -f deploy/loadtest/docker-compose.loadtest.yml \
    --profile loadtest run --rm --no-deps seed
docker compose -p tfscale -f deploy/docker-compose.yml run --rm --no-deps web python manage.py ensure_partitions

# 3) Test: 10 000 foydalanuvchi, soniyasiga 25 tadan kiradi, 12 daqiqa
docker compose -p tfscale -f deploy/docker-compose.yml -f deploy/loadtest/docker-compose.loadtest.yml \
    --profile loadtest run --rm --no-deps locust
# Natija: deploy/loadtest/results/ (CSV + report.html). Windows Git Bash'da oldiga MSYS_NO_PATHCONV=1 qo'ying.

# 4) Tozalash
docker compose -p tfscale -f deploy/docker-compose.yml down -v
```

O'zgaruvchilar: `LT_USERS` (10000), `LT_SPAWN_RATE` (25/s), `LT_DURATION` (15m), `LT_PROCESSES` (8).
