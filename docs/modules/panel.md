# Modul: panel

**Vazifasi:** modelsiz yig'uvchi qatlam — bosh panel, xodimlar, qidiruv, izohlar, tarix, fayl yuklash, meta, taqvim, hisobot ("Qilingan ishlar").

**Fayllar:** `api.py` (~475 qator — butunlay o'qimang, `Grep` bilan funksiyani toping), `calendar.py`, `reports.py`. Modeli yo'q (`Comment`/`ActivityLog` — `core`da).

## API
`meta/`, `dashboard/`, `calendar/`, `people/`, `people/stats/`, `people/create/`, `people/<id>/`, `search/`, `workdone/`, `comments/`, `history/`, `files/<kind>/<id>/` — `../api.md`.

## Muhim qoidalar
- Xodimlar: PM faqat dasturchilarni, Boshliq barcha faol xodimlarni ko'radi (serverda). `?due_from=&due_to=` — shu oraliqda muddati bor (har qanday holatdagi) vazifasi bor xodimlar; teskari oraliq 400; qoida `tasks/filters.py: due_range`.
- Fayl yuklash: `_file_owner_check` — egalikni tekshiradi; media fayllar ochiq berilmaydi.
- Qidiruv: vazifa/loyiha kodi bo'yicha (qisman ham), dasturchiga faqat o'z vazifalari.
- Hisobot (`reports.py`): `ReportFilters.mine`, `work_report`, `activity_queryset`.
- Ko'p hisob bitta agregat SQL bilan olinadi (N+1 yo'q); o'zgartirganda shu xususiyatni saqlang.

## Bog'liqlik
`accounts`, `core`, `notifications`, `orders`, `projects`, `tasks` — eng yuqori yig'uvchi qatlam, uni hech kim import qilmaydi.

## Testlar
`apps/panel/tests/`: `test_people`, `test_reports`, `test_meta`, `test_codes`, `test_scale`, `factories.py` (umumiy test fabrikalari).
