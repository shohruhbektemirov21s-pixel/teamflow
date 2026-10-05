# TinyFish integration — TDD evidence

## Source and user journeys

Talablar foydalanuvchi so'rovidan olindi (alohida reja fayli berilmagan).

1. PM/Boshliq URL bilan TinyFish avtomatizatsiyasini boshlaydi va lokal task ID oladi.
2. PM/Boshliq URLsiz web tadqiqotni boshlaydi va keyin uning holati/natijasini oladi.
3. Tizim private URL, ruxsatsiz foydalanuvchi va TinyFish timeout'ini xavfsiz rad etadi.
4. Polling paytida vaqtinchalik timeout qayta uriniladi; asinxron start esa dublikat xarajat bo'lmasligi uchun retry qilinmaydi.

## RED → GREEN

- RED: `backend/.venv/Scripts/python.exe manage.py test apps.ai.tests -v 2` — `apps.ai.models` va `apps.ai.services` mavjud bo'lmagani uchun import xatosi bilan yiqildi.
- GREEN: `backend/.venv/Scripts/python.exe manage.py test apps.ai.tests -v 2` — 10 test muvaffaqiyatli o'tdi.

## Test specification

| # | Kafolat | Test | Turi | Natija |
|---|---|---|---|---|
| 1 | URL avtomatizatsiyasi TinyFish async endpointiga API key, timeout va structured schema bilan yuboriladi | `test_starts_async_automation_with_structured_output` | service | PASS |
| 2 | Polling timeout'i ikki marta qayta urinadi, keyin nazoratli xato beradi | `test_retries_timeout_when_polling_status` | service | PASS |
| 3 | URLsiz so'rov Research async endpointiga yuboriladi | `test_starts_research_when_url_is_not_provided` | service | PASS |
| 4 | Local/private/file URL TinyFish chaqiruvidan oldin bloklanadi | `test_rejects_private_or_local_urls_before_calling_tinyfish` | security/service | PASS |
| 5 | PM avtomatizatsiyani boshlasa run saqlanadi va `202` qaytadi | `test_manager_starts_url_automation_and_run_is_saved` | API | PASS |
| 6 | Research run saqlanadi; polling tugallangan natijani normalize qiladi | `test_manager_starts_research_when_url_is_null`, `test_owner_can_refresh_a_completed_task_status` | API | PASS |
| 7 | Dasturchi endpointdan foydalana olmaydi | `test_developer_cannot_start_web_agent` | permission | PASS |
| 8 | Noto'g'ri ichki URL va provider timeout'i tushunarli JSON xatosi beradi | `test_invalid_internal_url_is_rejected`, `test_provider_timeout_returns_clear_json_error_without_crashing` | API/error | PASS |

## Yakuniy tekshiruv

- `backend/.venv/Scripts/python.exe manage.py test -v 1`: **205** backend test PASS.
- `backend/.venv/Scripts/python.exe manage.py makemigrations --check --dry-run`: **No changes detected**.
- `frontend/npm run build`: TypeScript va Vite build PASS.
- `backend/.venv/Scripts/python.exe -m coverage --version`: coverage moduli o'rnatilmagan; shu sabab sonli coverage hisoboti yo'q. Yangi xizmat va endpointning barcha muhim yo'llari alohida testlangan.

## Chegaralar

Haqiqiy TinyFish API kaliti repoda yo'q va testlarda kerak emas: barcha tashqi HTTP chaqiriqlar mock qilingan. Jonli TinyFish bajarilishini tekshirish uchun `backend/.env`ga kalit kiritilishi va TinyFish akkauntida kerakli imkoniyat yoqilgan bo'lishi kerak.
