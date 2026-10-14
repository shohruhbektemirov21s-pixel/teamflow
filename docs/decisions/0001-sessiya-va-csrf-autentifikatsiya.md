# 0001 — Sessiya + CSRF autentifikatsiya

- Holat: Qabul qilingan
- Sana: 2026-09-28 (hujjatlashtirilgan 2026-10-14)
- Manba: `docs/ARCHITECTURE.md` §2

## Kontekst
SPA va API bitta origin'da beriladi (Django frontend buildni ham xizmat qiladi).

## Qaror
DRF `SessionAuthentication` (loyihada `apps.core.authentication.SessionAuth`) + CSRF. Token `localStorage`da saqlanmaydi.

## Nima uchun
Bir origin — sessiya cookie ishlaydi, XSS orqali token o'g'irlanish xavfi kam, qo'shimcha kutubxona kerak emas.

## Oqibatlar
Frontend avval `GET /api/auth/csrf/` oladi. Boshqa origin'dan mijoz (mobil ilova) qo'shilsa, bu qaror qayta ko'rib chiqiladi. Cookie sozlamalari: `HttpOnly`, `SameSite=Lax`.
