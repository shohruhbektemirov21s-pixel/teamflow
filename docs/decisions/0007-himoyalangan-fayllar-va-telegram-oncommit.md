# 0007 — Fayllar faqat ruxsat bilan; Telegram `on_commit`/outbox

- Holat: Qabul qilingan
- Sana: 2026-09-28 / 2026-10-06
- Manba: `docs/ARCHITECTURE.md` §3, §9; `backend/config/urls.py`; `apps/panel/api.py: _file_owner_check`

## Qaror
1. Yuklangan fayllar (`MEDIA_ROOT`) ochiq berilmaydi — faqat `GET /api/files/<kind>/<id>/` orqali, egalik tekshiruvi bilan (`order-version`, `project`, `task`, `submission`). Profil rasmi, portfolio video/muqova ham alohida himoyalangan endpointlar orqali.
2. Fayl yuklashda tur va hajm `core/files.py` da tekshiriladi (.docx, rasm, PDF; video — portfolio).
3. Telegram xabari tranzaksiya tasdiqlangandan keyin (`on_commit`), timeout bilan; production'da outbox (`TelegramDelivery`) + alohida worker. Xato loglarida URL/token yozilmaydi.

## Nima uchun
Amal bekor bo'lsa xabar ketmasin; so'rov Telegramni kutib qolmasin; boshqa rolning hujjati oqib chiqmasin; token gitga/logga tushmasin.

## Oqibatlar
Yangi fayl turi qo'shilsa: `_file_owner_check` ga qo'shish va egalik testi yozish majburiy. Token `backend/.env` da, hech qachon commit qilinmaydi (repo ommaviy).
