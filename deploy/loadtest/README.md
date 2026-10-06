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

## Natijalar (2026-10-06)

Stend: bitta Windows kompyuter, Docker Desktop (20 vCPU, 8 GB RAM). **Yuk generatori (Locust, ~3 yadro) ham shu
mashinada** — server uchun ~16 yadro qoladi. Ssenariy og'ir: 10 000 foydalanuvchining **hammasi faol**
(har 10–30 s da bitta amal), soniyasiga 25 tadan kiradi (~7 daqiqada hammasi), keyin barqaror rejim; jami 12 daqiqa.

### To'rt yugurish — har biri nimani topdi

| # | Sozlama | Natija | Topilgan muammo → tuzatish |
|---|---|---|---|
| 1 | 4 gunicorn worker × 8 oqim, PBKDF2 | ~9 000 foydalanuvchida **8% xato** | Nginx `multi_accept on`: hamma ulanishni bitta worker oldi, 16 384 ga yetib uzdi → `reuseport`, 32 768 |
| 2 | 12 × 8, Nginx tuzatilgan | Login paytida xato 0, lekin 10 000 da **Redis yiqildi** (14 559 xato, butun sayt 500) | `channels_redis` core qatlami har WebSocket uchun Redis ulanishi to'pladi (10 000 chegara) → **pub/sub qatlam + alohida `redis-channels`** |
| 3 | + Argon2id, pub/sub | Asosiy Redis'da 625 WebSocket'ga 819 ulanish — yana oqish | `ws` sessiyani Django keshidan o'qirdi; kesh async kontekstda har WebSocket'ga alohida ulanish ochib yopmaydi → `ws` da sessiya bazadan (`backends.db`) |
| 4 | 12 × 4, hammasi tuzatilgan | **339 668 so'rov, 15 xato (0,004%)** | — (quyida) |

### Yakuniy yugurish (4)

| Ko'rsatkich | Qiymat |
|---|---|
| Foydalanuvchilar / ochiq WebSocket | 10 000 / 10 000 (ulanish xatosi 0, ulanish ~31 ms) |
| Login | 10 000 / 10 000 muvaffaqiyatli |
| So'rovlar / xato | 339 668 / 15 (0,004%) — gunicorn worker'i rejali qayta ishga tushganda uzilgan ulanishlar |
| Barqaror throughput | ~560–600 so'rov/s |
| Javob vaqti (barqaror, o'rtacha) | ~4 s — **CPU yetmadi** (pastda) |
| Redis ulanishlari | asosiy: ~49, `redis-channels`: 2–6 (10 000 WebSocket'da ham) |
| Xotira | web 1,2–2 GB (12 jarayon), ws ~510 MB (10 000 WebSocket), nginx ~650 MB, postgres ~340 MB, redis ~35 MB |
| CPU | web ~10 yadro (12 jarayon, har biri GIL chegarasida), postgres ~2, ws <0,5 |

**Xulosa.** Tizim 10 000 bir vaqtdagi foydalanuvchida **qulamaydi**: ulanishlar, Redis, PostgreSQL va xotira barqaror,
xato 0,004%. Javob sekinligi dastur xatosi emas — ssenariy soniyasiga ~700 so'rov talab qildi, bu mashinada
`web` ~10 yadro bilan ~600 tasini bajardi, qolgani navbatda kutdi. PostgreSQL ~2 yadroda, 48 ulanishdan 45 tasi
bo'sh turgan (profil: `py-spy`) — tor joy faqat Python CPU.

### Server o'lchami (o'lchovdan)

- Bitta `web` yadrosi ≈ **55–60 so'rov/s** (yuk ostida, barcha middleware, sessiya, throttling bilan).
- Faol foydalanuvchi (har 10–30 s da amal) ≈ 0,07 so'rov/s. **Ochiq, lekin harakatsiz tab ≈ 0** (WebSocket, polling yo'q):
  10 000 ochiq tab = ~0,5 yadro, ~500 MB RAM.
- Login: Argon2id ~47 ms CPU (PBKDF2 ~675 ms edi) — 25 login/s ≈ 1,2 yadro.

| Bir vaqtda **faol** foydalanuvchi | Kerakli so'rov/s | `web` yadrolari | Tavsiya (jami server) |
|---|---|---|---|
| 1 000 | ~70 | 2 | 2–4 CPU, 4 GB |
| 3 000 | ~210 | 4 | 4–8 CPU, 8 GB |
| 10 000 (hammasi faol) | ~700 | 12–14 | 16 CPU, 8–16 GB yoki 2 server × 8 CPU |

`WEB_WORKERS` ≈ `web` uchun ajratilgan yadrolar soni (oqimlar 4 — GIL sabab ko'proq oqim foyda bermaydi).
