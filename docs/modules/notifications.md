# Modul: notifications

**Vazifasi:** ilova ichidagi bildirishnomalar va Telegram orqali yetkazish.

**Fayllar:** `models.py`, `services.py` (`notify`), `api.py`, `delivery.py`, `telegram.py`, `admin.py`, `management/commands/{runbot,delivertelegram}.py`.

## Modellar
`Notification` (oluvchi, tur, maqsad obyekti — generic, o'qilgan/o'qilmagan), `TelegramDelivery` (yetkazish navbati — outbox).

## API
`notifications/` (faqat o'zimniki), `unread_count/`, `<id>/read/`, `read_all/` — `../api.md`. Ba'zi bildirishnomalarda amal tugmasi bor (loyiha yakunlashiga "Ha, tayyor"/"Yo'q"; `needs_ack`).

## Muhim qoidalar
- Servislar bildirishnomani bitta funksiya bilan yaratadi: `notifications.services.notify` (tarix uchun `core.services.log`).
- Telegram'ga yuborish tranzaksiya tugagach (`on_commit`); rejim `TELEGRAM_DELIVERY_MODE` (`thread` dev, `outbox` production → `delivertelegram` worker). Xato loglariga URL/token yozilmaydi.
- O'qilmaganlar soni keshlanadi va o'qish/yaratishdan keyin tozalanadi (`tests/test_cache.py`).
- Token `backend/.env` da (`TELEGRAM_BOT_TOKEN`) — **hech qachon commit/hujjat/log'ga yozilmaydi**.
- UI: "Bildirishnomalar" — modal (`NotificationsModal.tsx`), qo'ng'iroq ikonkasidan ochiladi.

## Bog'liqlik
Faqat `accounts` (`Role`, faol PM/Boshliqlar). Deyarli hamma servis uni chaqiradi.

## Testlar
`apps/notifications/tests/`: `test_cache`, `test_delivery`, `test_telegram`.
