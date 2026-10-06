# TeamFlow — prod'ga joylash (Linux + Docker)

Windows kompyuterdagi ishlab chiqish rejimi (`backend/start_server.bat`, SQLite) o'zgarmaydi.
Bu papka — 10 000+ bir vaqtdagi foydalanuvchi uchun prod stack. Arxitektura va qarorlar sababi:
`docs/ARCHITECTURE.md` 14-bo'lim.

```
Brauzer ──► nginx ──┬─ /static, SPA ────────────► fayldan (Django'ga tushmaydi)
                    ├─ /api, /admin ──► web  (gunicorn) ─────────────┬──► postgres 17 (oylik partitsiyalar)
                    └─ /ws ──────────► ws   (daphne, WebSocket)  ───┼──► redis (kesh, sessiya, throttling)
                                                                     └──► redis-channels (WebSocket hodisalari)
                                       scheduler (kunlik: partitsiyalar, eski sessiyalar)
```

## 1. Talablar

- Linux server, Docker Engine 24+ va Docker Compose v2.
- Minimal: **2 CPU, 4 GB RAM** (standart sozlamalar shunga, ~1 000 faol foydalanuvchi).
- 10 000 bir vaqtda **faol** foydalanuvchi uchun: ~16 CPU, 8–16 GB RAM (yoki 2 server × 8 CPU). Ochiq, lekin
  harakatsiz tablar deyarli resurs olmaydi. O'lchov va jadval: `deploy/loadtest/README.md`.
- Domen va HTTPS sertifikati (TLS tashqi load balancer'da yoki Nginx'da — 5-bo'lim).

## 2. Birinchi ishga tushirish

```bash
git clone <repo> teamflow && cd teamflow
cp deploy/.env.example deploy/.env
# deploy/.env: DJANGO_SECRET_KEY, POSTGRES_PASSWORD, DJANGO_ALLOWED_HOSTS, DJANGO_CSRF_TRUSTED_ORIGINS
docker compose -f deploy/docker-compose.yml up -d --build
docker compose -f deploy/docker-compose.yml exec web python manage.py createsuperuser
```

`migrate` servisi har ishga tushishda migratsiyalarni va oylik partitsiyalarni qo'llaydi, `web`/`ws` undan keyin turadi.
Telegram bot kerak bo'lsa: `deploy/.env` ga `TELEGRAM_BOT_TOKEN` va `docker compose ... --profile telegram up -d`.

## 3. Yangilash (yangi versiya)

```bash
git pull
docker compose -f deploy/docker-compose.yml up -d --build
```

Image qayta yig'iladi, `migrate` ishlaydi, servislar yangisiga almashadi. Ochiq tablar WebSocket uzilganini sezib,
tasodifiy kechikish bilan (1–30 s) qayta ulanadi — 10 000 tab bir soniyada urilmaydi.

## 4. Mavjud ma'lumotni SQLite'dan ko'chirish (bir marta)

Windows'dagi ishlayotgan bazani yangi serverga o'tkazish:

```bash
# 1) Windows'da (backend papkasida), server to'xtatilgan holda:
.venv\Scripts\python manage.py dumpdata --natural-foreign --natural-primary ^
    -e contenttypes -e auth.permission -e sessions -e admin.logentry --indent 1 -o teamflow.json
# media papkasini ham oling: backend\media

# 2) Serverda — bo'sh bazaga (migrate allaqachon ishlagan):
docker compose -f deploy/docker-compose.yml cp teamflow.json web:/tmp/teamflow.json
docker compose -f deploy/docker-compose.yml exec web python manage.py loaddata /tmp/teamflow.json
docker compose -f deploy/docker-compose.yml exec web python manage.py sqlsequencereset accounts orders projects tasks notifications chat core suggestions ai \
    | docker compose -f deploy/docker-compose.yml exec -T postgres psql -U teamflow -d teamflow
docker compose -f deploy/docker-compose.yml exec web python manage.py ensure_partitions   # eski oylar o'z partitsiyasiga
docker compose -f deploy/docker-compose.yml cp backend/media/. web:/app/backend/media/
```

`ensure_partitions` eski oylar uchun ham partitsiya yaratib, qatorlarni DEFAULT'dan ko'chiradi.

## 5. HTTPS

- **Tashqi load balancer / reverse proxy** (tavsiya): TLS u yerda tugaydi, `X-Forwarded-Proto: https` uzatilsin.
- **Shu Nginx'da**: `deploy/nginx.conf` ga `listen 443 ssl;` bloki va sertifikat (masalan, certbot) qo'shiladi,
  compose'da `443:443` porti ochiladi.

`DJANGO_HTTPS=1` (standart): cookie faqat HTTPS orqali, HSTS yoqiladi.

## 6. Resurslarni sozlash

| O'zgaruvchi | Standart | Qachon oshirish |
|---|---|---|
| `WEB_WORKERS` | 4 | ≈ `web` uchun ajratilgan yadrolar soni (1 yadro ≈ 55–60 so'rov/s) |
| `WEB_THREADS` | 4 | O'zgartirmang: GIL sabab ko'proq oqim foyda bermaydi; bazaga ulanishlar puli shunga teng |
| `PG_SHARED_BUFFERS` | 256MB | ≈ server RAM'ining 25% |
| `PG_EFFECTIVE_CACHE` | 1GB | ≈ server RAM'ining 50–75% |
| `PG_MAX_CONNECTIONS` | 100 | `WEB_WORKERS × WEB_THREADS + 30` dan kam bo'lmasin |
| `REDIS_MAXMEMORY` | 256mb | Odatda yetadi |

Gorizontal kengaytirish (bir nechta server): `web` va `ws` holatsiz — barcha umumiy holat PostgreSQL va Redis'da.
Ko'p nusxada PostgreSQL ulanishlari ko'payadi — o'shanda oldiga PgBouncer qo'yiladi.

## 7. Oylik partitsiyalar va ma'lumot o'sishi

`notifications_notification`, `chat_chatmessage`, `core_activitylog` — har oy alohida jadval
(`..._p2026_10`). `scheduler` har kuni keyingi 3 oy jadvalini oldindan yaratadi; zaxira uchun `..._default`
jadval bor (yozuv hech qachon xato bermaydi).

Eski oyni arxivlash (masalan, 2 yildan eski bildirishnomalar) — millionlab `DELETE` emas, bir zumda:

```sql
ALTER TABLE notifications_notification DETACH PARTITION notifications_notification_p2024_01;
-- pg_dump bilan arxivlab, keyin: DROP TABLE notifications_notification_p2024_01;
```

Avtomatik o'chirish yo'q — qaysi ma'lumot qancha saqlanishini egasi hal qiladi.

## 8. Zaxira nusxa

```bash
docker compose -f deploy/docker-compose.yml exec -T postgres pg_dump -U teamflow -Fc teamflow > teamflow-$(date +%F).dump
docker run --rm -v teamflow_media:/m -v "$PWD":/b alpine tar czf /b/media-$(date +%F).tgz -C /m .
```

## 9. Yuk testi

`deploy/loadtest/README.md` — faqat alohida sinov stendida (soxta 10 000 foydalanuvchi yaratadi).
