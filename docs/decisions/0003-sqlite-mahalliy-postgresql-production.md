# 0003 — Mahalliy SQLite, production PostgreSQL + Redis

- Holat: Qabul qilingan
- Sana: 2026-10-06 (hujjatlashtirilgan 2026-10-14)
- Manba: `docs/ARCHITECTURE.md` §2, §3.1; `backend/deploy/README.md`; `docs/decisions/requirements-log.md` (2026-10-06, 10 000+ foydalanuvchi)

## Kontekst
Mahalliy ishlab chiqishda SQLite yetarli; bir vaqtda 10 000+ faol foydalanuvchi uchun yozish va tranzaksiya bloklashlari muammo.

## Qaror
Mahalliy: SQLite (`DATABASE_URL` bo'sh). Production: PostgreSQL + Redis (kesh, sessiya `cached_db`), Nginx → Gunicorn, Telegram outbox worker. Production SQLite'ga yashirin qaytmaydi.

## Nima uchun
PostgreSQL parallel yozishni ko'taradi; Redis unread soni va reyting kabi qaynoq ma'lumotlarni keshlaydi.

## Oqibatlar
Testlar `scripts/verify.ps1` da `DATABASE_URL`/`REDIS_URL` bo'shatilgan holda ishlaydi (amaldagi bazaga tegmaydi). Yakuniy sig'im raqami faqat tanlangan serverda capacity test bilan tasdiqlanadi. Haqiqiy server/TLS va SQLite → PostgreSQL ma'lumot o'tkazishi hali bajarilmagan va ruxsat bilan amalga oshiriladi.
