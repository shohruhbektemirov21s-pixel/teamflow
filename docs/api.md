# TeamFlow — API ma'lumotnomasi (`/api/`)

> Manba: `backend/config/urls.py` va `backend/apps/*/api.py` (2026-10-14 holatida kod bilan solishtirilgan).
> Maydonlar (request/response shakli) bu yerda yozilmaydi — ular `apps/<app>/serializers.py` da. Endpoint qo'shilsa/o'zgarsa, shu fayl yangilanadi (`CLAUDE.md` §7, DOCUMENT bosqichi).

## Umumiy qoidalar

- Autentifikatsiya: **sessiya + CSRF** (`apps.core.authentication.SessionAuth`). Avval `GET /api/auth/csrf/`.
- Standart ruxsat: `IsAuthenticated`. Quyidagi jadvalda "Ruxsat" ustuni kodda ko'rinadigan **to'siqni** ko'rsatadi; ko'rinish chegarasi (kim qaysi yozuvni ko'radi) `visible_*` funksiyalarida (`apps/<app>/permissions.py`), holat o'tishlari esa `workflow.py` va `services.py` da tekshiriladi.
- Sahifalash: `apps.core.pagination.BoundedPagination` (sahifa hajmi 50). Ayrim ro'yxatlar `?all=1` bilan sahifalanmaydi (chegaralangan).
- Xatolar: `apps.core.api_utils.api_exception_handler`.
- Tezlik cheklovi: `auth` 20/daq (anonim login/ro'yxatdan o'tish), `ai_web_agent` 5/soat.
- Sog'liq: `GET /healthz/live/`, `GET /healthz/ready/` (baza + kesh tekshiruvi, `/api/` dan tashqarida). `/admin/` — Django admin.

Ruxsat belgilari: **Auth** = tizimga kirgan, **Manager** = PM yoki Boshliq (`IsManager`), **Dept** = Boshqarma (`IsDepartment`), **Ochiq** = `AllowAny`.

## Auth va profil (`accounts`)

| Marshrut | Metod | Ruxsat | Izoh |
|---|---|---|---|
| `auth/csrf/` | GET | Ochiq | CSRF cookie |
| `auth/register/` | POST | Ochiq (throttle) | `is_active=False` bilan yaratadi |
| `auth/login/` | POST | Ochiq (throttle) | |
| `auth/logout/` | POST | Auth | |
| `auth/me/` | GET | Auth | joriy foydalanuvchi |
| `auth/profile/` | GET, PATCH | Auth | o'z profili |
| `auth/password/` | POST | Auth | |
| `auth/avatar/` | POST, DELETE | Auth | o'z rasmi |
| `avatars/<id>/` | GET | Auth | rasm faylini beradi |
| `specialties/` | GET | Ochiq | ro'yxatdan o'tish formasi uchun |
| `developers/` | GET | Auth | dasturchilar ma'lumotnomasi |
| `people/<id>/business-trip/` | PUT, DELETE | Faqat Boshliq (funksiya ichida) | xizmat safari; faqat faol PM va dasturchilar uchun |
| `people/<id>/responsibilities/` | PATCH | Manager (funksiya ichida) | mas'uliyatlar matni; PM faqat dasturchilarni, Boshliq barcha faol xodimlarni |

## Panel (`panel`, modelsiz yig'uvchi qatlam)

| Marshrut | Metod | Ruxsat | Izoh |
|---|---|---|---|
| `meta/` | GET | Ochiq | tanlov ro'yxatlari (rol, holat…) |
| `dashboard/` | GET | Auth | bosh panel hisoblari |
| `calendar/` | GET | Auth | taqvim (`panel/calendar.py`) |
| `people/` | GET | Manager | xodimlar ro'yxati; `?due_from=&due_to=` |
| `people/stats/` | GET | Manager | xodimlar statistikasi |
| `people/create/` | POST | Manager | yangi xodim |
| `people/<id>/` | GET | Auth | xodim profili |
| `search/` | GET | Auth | umumiy qidiruv (kod bo'yicha ham) |
| `workdone/` | GET | Manager | "Qilingan ishlar" hisoboti |
| `comments/` | GET, POST | Auth | izohlar (obyekt turi + id bilan) |
| `history/` | GET | Auth | faoliyat tarixi (ruxsatli doira) |
| `files/<kind>/<id>/` | GET | Auth + egalik tekshiruvi | himoyalangan fayl yuklash (`order-version`, `project`, `task`, `submission`) |

## Buyurtmalar (`orders`) — router `orders/`

| Marshrut | Metod | Ruxsat |
|---|---|---|
| `orders/` | GET | Auth (`visible_orders`) |
| `orders/` | POST | Dept |
| `orders/<id>/` | GET | Auth (`visible_orders`) |
| `orders/<id>/versions/` | POST | Auth (workflow: faqat rad etilgandan keyin, Dept) |
| `orders/<id>/approve/` | POST | Auth (workflow: Manager) |
| `orders/<id>/reject/` | POST | Auth (workflow: Manager) |
| `orders/<id>/dates/` | POST | Manager (`require_manager`) |

## Loyihalar (`projects`) — router `projects/`

| Marshrut | Metod | Ruxsat |
|---|---|---|
| `projects/` | GET | Auth (`visible_projects`) |
| `projects/lookup/` | GET | Auth |
| `projects/` | POST | Manager |
| `projects/<id>/` | GET | Auth (`visible_projects`) |
| `projects/<id>/` | PATCH | Manager |
| `projects/<id>/members/` | PUT | Manager |
| `projects/<id>/files/` | POST | Manager |
| `projects/<id>/files/<file_id>/` | DELETE | Manager |
| `projects/<id>/confirm-completion/` | POST | Dept (buyurtmani yuborgan boshqarma) |
| `projects/<id>/reject-completion/` | POST | Dept |
| `projects/<id>/completion-ack/` | POST | Auth (`projects/services.py: ack_completion` — faqat yakunlash tasdig'i so'ralgan dasturchi) |
| `projects/setup/` | POST | Manager (`apps/tasks/api.py: project_setup` — loyiha + jamoa + vazifalar bitta tranzaksiyada) |

## Vazifalar (`tasks`) — router `tasks/`

| Marshrut | Metod | Ruxsat |
|---|---|---|
| `tasks/` | GET | Auth (`visible_tasks`/`listed_tasks`); `?all=1` sahifalamaydi |
| `tasks/` | POST | Auth (loyiha `visible_projects` ichida bo'lishi shart; qolgan qoidalar `tasks/services.py: create_task`) |
| `tasks/<id>/` | GET, PATCH, DELETE | Auth (servisda tekshiriladi) |
| `tasks/<id>/start/` | POST | Auth (workflow: dasturchi/PM/Boshliq) |
| `tasks/<id>/submit/` | POST | Auth (workflow: faqat biriktirilgan dasturchi) |
| `tasks/<id>/review/` | POST | Auth (workflow: Manager — qabul/qaytarish) |
| `tasks/<id>/files/` | POST | Auth |
| `tasks/<id>/assignees/` | PUT | Auth (`can_manage_assignees`) |
| `tasks/<id>/subtasks/` | POST | Auth (`can_manage_subtasks`) |
| `tasks/<id>/subtasks/<sid>/` | DELETE | Auth |
| `tasks/<id>/subtasks/<sid>/toggle/` | POST | Auth |
| `tasks/<id>/worklogs/` | POST | Auth |
| `tasks/<id>/worklogs/<eid>/` | DELETE | Auth |
| `tasks/bulk/` | POST | Auth (loyiha `visible_projects` ichida; qoidalar `tasks/services.py: create_bulk_tasks`) |

## Bildirishnomalar (`notifications`), taklif (`suggestions`), chat (`chat`)

| Marshrut | Metod | Ruxsat |
|---|---|---|
| `notifications/` | GET | Auth (faqat o'ziniki) |
| `notifications/unread_count/` | GET | Auth |
| `notifications/<id>/read/` | POST | Auth |
| `notifications/read_all/` | POST | Auth |
| `suggestions/` | GET, POST | Auth |
| `suggestions/<id>/` | GET, DELETE | Auth (o'chirish: faqat o'z, anonim bo'lmagan) |
| `suggestions/<id>/vote/` | POST, DELETE | Auth |
| `suggestions/<id>/decide/` | POST | Auth (workflow: faqat Boshliq) |
| `chat/people/`, `chat/conversations/`, `chat/messages/` | GET | Auth |
| `chat/send/` | POST | Auth |

## Portfolio (`portfolio`)

| Marshrut | Metod | Izoh |
|---|---|---|
| `portfolio/` | GET | dasturchilar reytingi; `?following=1&specialty=&sort=followers\|projects\|reviews` |
| `portfolio/summary/` | GET | umumiy ko'rsatkichlar |
| `portfolio/my-reviews/` | GET | o'zim bergan baholar |
| `portfolio/<id>/` | GET | dasturchi sahifasi |
| `portfolio/<id>/follow/` | POST, DELETE | kuzatish (`can_follow`) |
| `portfolio/items/` | POST | loyiha qo'shish |
| `portfolio/items/<id>/` | GET, PATCH, DELETE | `can_edit_item` |
| `portfolio/items/<id>/reviews/` | GET, POST, DELETE | baho va sharh (`can_review_item`) |
| `portfolio/items/<id>/videos/` | POST | video yuklash |
| `portfolio/items/<id>/videos/<video_id>/` | DELETE | |
| `portfolio/videos/<id>/` | GET | video faylini beradi (Range qo'llab-quvvatlanadi) |
| `portfolio/items/<id>/cover/` | POST, DELETE | muqova rasmi |
| `portfolio/covers/<id>/` | GET | muqova faylini beradi |

Barcha `portfolio/*` endpointlar `IsAuthenticated` (standart). Egalik/ruxsat — `apps/portfolio/permissions.py`.

## AI web-agent (`ai`)

| Marshrut | Metod | Ruxsat |
|---|---|---|
| `ai/web-agent/` | POST | Manager (throttle `ai_web_agent`) |
| `ai/web-agent/<id>/` | GET | Manager |
