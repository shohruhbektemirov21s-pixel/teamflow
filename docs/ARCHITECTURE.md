# TeamFlow — Arxitektura

> Yozildi: 2026-09-28 (senior arxitektor sifatida). Talablar manbai: `README.md`. Bu hujjat "qanday qurilishi"ni belgilaydi.
> Har bir muhim qaror **Nima uchun** bilan yozilgan.

## 1. Umumiy ko'rinish

```
 Brauzer (React + TS SPA, dev: 127.0.0.1:5173)
        │  /api/*, /admin/*  (Vite proksi orqali yoki to'g'ridan-to'g'ri)
        ▼
 Django + DRF (127.0.0.1:8020) ── apps: accounts · orders · projects · tasks · notifications · core · panel
        │
        ├── SQLite (db.sqlite3)
        └── media/ (yuklangan fayllar: TZ .docx, rasm, PDF — faqat /api/files/... orqali)
 Django admin (/admin/) ── foydalanuvchini tasdiqlash, Boshliq yaratish, ma'lumotnomalar
```

Portlar: Django `127.0.0.1:8020` (8000-port boshqa dastur bilan band). Vite dev `127.0.0.1:5173`.
Deployment: bitta Django jarayoni (`127.0.0.1:8020`). Frontend build (`frontend/dist`) Django orqali beriladi (`http://127.0.0.1:8020/`), shuning uchun serverda Node kerak emas. Ishlab chiqishda Vite dev-server `/api` va `/admin` ni 8020-portga proksi qiladi.

## 2. Texnologiya qarorlari

| Qaror | Tanlov | Nima uchun |
|---|---|---|
| Backend | Python 3.14, Django 5.2, DRF 3.17 | Talab. Django admin tayyor tasdiqlash paneli beradi. |
| DB | SQLite | Talab ("Django'nikidan"). Hamma so'rov ORM orqali, keyin PostgreSQL'ga o'tish oson. |
| Auth | **Sessiya + CSRF** (DRF `SessionAuthentication`) | Bir origin (SPA Django orqali beriladi). Token `localStorage`da saqlanmaydi, XSS xavfi kam. Qo'shimcha kutubxona kerak emas. |
| Foydalanuvchi | `AbstractUser` kengaytmasi, `role` maydoni | Rollar 4 ta, qat'iy. Alohida Role/Permission jadvali ortiqcha. |
| Frontend | React + TypeScript + Vite | Kelishilgan. Node faqat build uchun. |
| Frontend kutubxonalar | react-router, TanStack Query, dnd-kit, docx-preview | Marshrut (modal holati brauzer tarixida, manzil toza), server holati keshi, sudrab o'tkazish, .docx ko'rish. UI kutubxonasi (MUI va h.k.) olinmaydi, o'z dizayn tokenlarimiz bor. |
| Stil | Oddiy CSS + CSS o'zgaruvchilar (tokenlar) | Tungi/kunduzgi rejim tokenlarni almashtirish bilan. |
| Fayl saqlash | `MEDIA_ROOT`, `FileField` | SQLite bilan mos, sodda. |

## 3. Backend tuzilmasi

```
backend/
  manage.py
  requirements.txt
  config/            settings.py, urls.py, wsgi.py, asgi.py
  apps/
    core/            umumiy: choices, fayl validatsiyasi, kod yordamchilari (codes.py: tasodifiy 9 xonali kod — `apps.get_model` orqali, Task/Project statik import qilinmaydi), davrlar (periods.py), Comment, ActivityLog
    accounts/        User, Specialty, ro'yxatdan o'tish, login, ruxsat yordamchilari
    orders/          Order, OrderVersion, buyurtma holat mashinasi, servislar
    projects/        Project, ProjectMember, ProjectFile
    tasks/           Task, TaskAssignment, SubTask, Submission, WorkLog, holat mashinasi
    notifications/   Notification, notify(); telegram.py (Bot API: yuborish, /start bilan chat bog'lash), runbot buyrug'i
    chat/            ChatMessage, validatsiya va suhbat servislar (suhbatda oxirgi 200 xabar)
    suggestions/     Suggestion, SuggestionVote; holat o'tishi workflow.py, amallar services.py
    panel/           modelsiz yig'uvchi qatlam: dashboard, people, search, comments, history, files, meta
```

### Qatlamlar (har bir app ichida)

```
models.py       ma'lumot va invariantlar (faqat DB bilan bog'liq qoida)
workflow.py     holat o'tishlari — BITTA joyda (faqat sof funksiyalar, DB'siz)
services.py     biznes amallari (tranzaksiya): approve_order, submit_task, ...
permissions.py  kim nima qila oladi (rol + egalik) — BITTA joyda
serializers.py  kirish/chiqish shakli va validatsiya
api.py          DRF ViewSet'lar: yupqa, faqat servisni chaqiradi
admin.py        Django admin
tests/          workflow, permissions, services, api
```

### Bog'liqlik yo'nalishi (tsikl yo'q)

```
core  ←  accounts  ←  orders  ←  projects  ←  tasks
                         ↑          ↑           ↑
                         └── notifications ─────┘   (hamma chaqiradi, o'zi hech kimni import qilmaydi)
```

- Pastdagi app yuqoridagini **import qilmaydi**. `orders` → `projects` bog'lanishi (loyiha yaratish) `projects.services` ichida bajariladi, `orders` faqat `Project.order` OneToOne orqali ko'rinadi.
- **Nima uchun:** eski TeamFlow auditida "qatlam buzilishi" topilgan edi; shu yo'nalishni boshidanoq qat'iy qilamiz.
- Bildirishnoma va tarix (`ActivityLog`) servislar ichidan bitta yordamchi funksiya bilan yoziladi (`notifications.services.notify`, `core.services.log`).
- Telegram'ga yuborish `transaction.on_commit` da, bitta fon oqimida, 5 soniya timeout bilan. **Nima uchun:** amal bekor bo'lsa xabar ketmasin, so'rov Telegram'ni kutib qolmasin. Token `TELEGRAM_BOT_TOKEN` (va havola uchun `TELEGRAM_BOT_USERNAME`) — `backend/.env` da yoki muhit o'zgaruvchisida; `.env` ni `config/settings.py` kutubxonasiz o'qiydi, haqiqiy muhit o'zgaruvchisi ustun. **Nima uchun:** token gitga tushmasin, autostart (`start_server.bat`) ham uni topsin. Xato loglarida URL (demak token) yozilmaydi — faqat holat kodi.
- Taqvim loyihalarni `GET /api/projects/?end_from=&end_to=&all=1` bilan oladi (`all=1` — sahifalanmaydi, `visible_projects` bilan cheklangan); kun modali vazifalarni `GET /api/tasks/?date=&all=1` bilan oladi.

## 4. Ma'lumotlar modeli

### accounts
| Model | Maydonlar | Izoh |
|---|---|---|
| `Specialty` | name (unique), is_active | Mutaxassisliklar ro'yxati **Django adminda** boshqariladi (ochiq savol yopildi). |
| `User` | username (login), first_name, last_name, password, role, specialty FK?, department_name, telegram_username, telegram_chat_id, avatar (rasm, 1024px JPEG), is_active | `role`: boss / pm / developer / department. Ro'yxatdan o'tganlar `is_active=False` bilan yaratiladi, admin faollashtiradi. Boshliq admin orqali. |

### orders
| Model | Maydonlar |
|---|---|
| `Order` | title, description, priority, requested_due_date, submitted_by FK, status (submitted/approved/rejected/project_created), approved_by FK?, start_date?, end_date?, pm_note, decided_at?, created_at |
| `OrderVersion` | order FK, number (1,2,…), file, uploaded_by, decision (pending/approved/rejected), reject_reason, decided_by?, decided_at?, created_at. `unique(order, number)` |

Qoidalar: yangi versiya faqat oxirgi versiya `rejected` bo'lsa. Boshqarma `Order` va `OrderVersion` ni o'zgartira/o'chira olmaydi (faqat yangi versiya qo'shadi). Buyurtma maydonlari `draft` holatisiz darrov yuboriladi.

### projects
| Model | Maydonlar |
|---|---|
| `Project` | code (tasodifiy 9 xonali, unique), name, description, order OneToOne?, stage (planned/started/needs_fix/done), start_date, end_date, created_by, created_at |
| `ProjectMember` | project FK, developer FK, `unique(project, developer)` |
| `ProjectFile` | project FK, file, uploaded_by, created_at |

Qoida: `order` bilan bog'langan loyihada PM faqat `start_date`/`end_date` ni o'zgartira oladi.

### tasks
| Model | Maydonlar |
|---|---|
| `Task` | code (tasodifiy 9 xonali, unique), project FK (PROTECT), title, description, priority, status (control/in_progress/in_review/done), starts_at?, due_at?, completed_at?, archived_at?, created_by, created_at |
| `TaskAssignment` | task FK, developer FK, `unique(task, developer)` — bitta vazifa bir nechta dasturchiga |
| `SubTask` | task FK, title, assignees M2M (bir nechta dasturchi), is_done, position |
| `TaskFile` | task FK, file, uploaded_by |
| `Submission` | task FK, round, submitted_by, note, decision (pending/accepted/returned), reviewed_by?, review_note, submitted_at, reviewed_at? |
| `SubmissionFile` | submission FK, file |
| `WorkLog` | task FK, author FK, work_date, hours, note, created_at. Soat 0 dan katta va 24 dan oshmaydi. |

Hisoblanadigan (saqlanmaydi): `is_overdue` = muddat o'tgan, `done` va arxivda emas; `finished_late` = `completed_at > due_at`.
**Nima uchun:** holatdan kelib chiqadigan qiymatni saqlash — nomuvofiqlik manbai.
`DELETE /api/tasks/{id}/` vazifani arxivlaydi: bog'liq topshirish, ish jurnali, izoh va fayllar saqlanadi. Oddiy ro'yxatlar arxivni yashiradi, ruxsatli tafsilot va tarix uni o'qiy oladi; arxivdagi vazifa tahrirlanmaydi.

### core / notifications
| Model | Maydonlar |
|---|---|
| `Comment` | author, text, target (GenericFK: Order/Project/Task), created_at |
| `ActivityLog` | actor, verb, message, target (GenericFK), created_at — "Umumiy tarix" |
| `Notification` | recipient, kind, message, target (GenericFK), is_read, created_at |

### chat
| Model | Maydonlar |
|---|---|
| `ChatMessage` | author FK, recipient FK, text, is_read, created_at. Kiruvchi suhbat ro'yxati uchun `recipient, author, created_at` indeksiga ega. |

Chat API serializer orqali sherikni (faol foydalanuvchi, o'ziga teng emas) va xabar matnini tekshiradi. Suhbat ro'yxati guruhlangan unread-count so'rovidan foydalanadi; har bir suhbat uchun alohida `COUNT` qilinmaydi.

## 5. Holat mashinalari

**Buyurtma:** `submitted → approved → project_created`, `submitted → rejected → (yangi versiya) submitted`.
**Vazifa:**
```
control ──(dasturchi/PM)──▶ in_progress ──(dasturchi: submit)──▶ in_review
                                 ▲                                   │
                                 └──── (PM/Boshliq: qaytarish) ◀─────┤
                                                       (PM/Boshliq: qabul) ▶ done
```
`done` ga faqat tekshiruv qabul qilganda o'tiladi; dasturchi to'g'ridan-to'g'ri `done` qila olmaydi.
**Loyiha darajasi:** `planned / started / needs_fix / done` — PM qo'lda, erkin o'tish.

Har bir mashina `workflow.py` da bitta `allowed_transitions` jadvali va bitta `check_transition(current, target, role)` funksiyasi bilan. UI va API shu jadvaldan foydalanadi, boshqa joyda takrorlanmaydi.

## 6. Ruxsatlar (RBAC + egalik)

Ruxsat qoidalari `permissions.py` da; API va servis ikkalasi ham tekshiradi (qatlamli himoya).

| Resurs | Ko'rish | Yaratish/o'zgartirish |
|---|---|---|
| Order | Boshqarma: o'zinikini. PM/Boshliq: hammasini | Boshqarma: faqat yaratish va yangi versiya. PM/Boshliq: tasdiqlash/rad |
| Project | PM/Boshliq: hammasi. Dasturchi: a'zosi bo'lganlar | PM/Boshliq |
| Task | PM/Boshliq: hammasi. Dasturchi: o'ziga biriktirilgan | Yaratish: PM/Boshliq. Holat: rolga qarab (5-bo'lim) |
| Comment | ko'rish huquqi bor hamma | ko'rish huquqi bor hamma |

Queryset darajasida ham filtr (`visible_orders(user)`, `visible_tasks(user)`), shunda ro'yxatda begona ma'lumot chiqmaydi.

## 7. API (REST, `/api/`)

```
POST   /api/auth/register/          ro'yxatdan o'tish (is_active=False)
POST   /api/auth/login/  logout/    sessiya
GET    /api/auth/me/                joriy foydalanuvchi + rol
POST/DELETE /api/auth/avatar/       o'z profil rasmi (multipart `avatar`)
GET    /api/avatars/{id}/           profil rasmi (faqat kirganlarga; `?v=` kesh uchun)
GET    /api/specialties/            ro'yxatdan o'tish formasi uchun

GET/POST   /api/orders/             POST: boshqarma (fayl bilan)
GET        /api/orders/{id}/
POST       /api/orders/{id}/versions/     yangi TZ versiyasi
POST       /api/orders/{id}/approve/      {start_date, end_date, note}
POST       /api/orders/{id}/reject/       {reason}
POST       /api/orders/{id}/create-project/

GET/POST   /api/projects/           POST: PM/Boshliq
GET/PATCH  /api/projects/{id}/
POST/DELETE /api/projects/{id}/members/, /files/
POST       /api/projects/setup/     loyiha + jamoa + har bir xodimga vazifa (multipart: tasks JSON, task_files_<n>);
                                    bitta tranzaksiya, tasks.services.create_project_with_tasks (tasks yuqori qatlam)

GET/POST   /api/tasks/
GET/PATCH/DELETE /api/tasks/{id}/     DELETE: arxivlash, tarixni saqlash
POST       /api/tasks/{id}/status/        {status}   (dasturchi: control→in_progress)
POST       /api/tasks/{id}/submit/        {note, files}
POST       /api/tasks/{id}/review/        {decision: accept|return, note}
CRUD       /api/tasks/{id}/subtasks/            POST {title, assignee_ids}
PATCH      /api/tasks/{id}/subtasks/{sid}/      {assignee_ids}  (menejer yoki vazifa ijrochisi)
PUT        /api/tasks/{id}/assignees/           {assignee_ids}  (menejer yoki vazifani yaratgan dasturchi; jamoadan tashqari dasturchi loyihaga qo'shiladi)
POST       /api/tasks/{id}/worklogs/      {work_date, hours, note}
DELETE     /api/tasks/{id}/worklogs/{entry_id}/

GET        /api/chat/people/?q=           faol xodimlar qidiruvi
GET        /api/chat/conversations/       so'nggi xabar va o'qilmaganlar soni
GET        /api/chat/messages/?partner=:id
POST       /api/chat/send/                {partner, text}

GET/POST   /api/comments/?target=order:12
GET        /api/notifications/  POST /api/notifications/{id}/read/
GET        /api/dashboard/      rolga mos hisob-kitob kartalari (Boshqarma: orders + periods — orders/filters.py)
GET        /api/orders/?period=week&bucket=sent|rejected|approved   bosh panel kartasi bilan bir xil ro'yxat
GET        /api/people/         xodimlar va bandligi (vazifasi yo'qlar tepada)
GET        /api/developers/     dasturchilar ro'yxati (menejer va dasturchi)
GET        /api/search/?q=...   global qidiruv (Ctrl K)
GET        /api/history/        umumiy tarix
GET        /api/meta/           rollar, holatlar, ruxsat etilgan o'tishlar (yagona manba)
GET        /api/files/{kind}/{id}/?download=1   ruxsat tekshiruvi bilan fayl yuklab olish/ochish
```

Xatolar: bir xil shakl `{code, detail, fields?}`. Sahifalash: DRF `PageNumberPagination`. Har bir ro'yxat `select_related/prefetch_related` bilan (N+1 testlar bilan qamrab olinadi).

## 8. Frontend tuzilmasi

```
frontend/src/
  app/            router, providers (Auth, Meta), layout (sidebar, topbar), modals host
  shared/         ui (Button, Modal, Badge...), tokens.css, i18n (uz.ts), api client, hooks, meta
  features/
    auth/         LoginPage, RegisterPage
    orders/       OrdersPage, OrderModal, OrderCreateModal
    projects/     ProjectsPage, ProjectModal, ProjectWizard
    tasks/        BoardPage (dnd-kit), TasksPage, TaskModal, TaskFormModal, ReviewPage
    dashboard/    kartalar, dasturchilar ro'yxati, filtrli jadval
    docs/         DocViewer (docx-preview, PDF, rasm)
    search/       SearchPalette (Ctrl K)
    calendar/     CalendarPage
    comments/     Comments
    history/      HistoryPage
    notifications/ NotificationsPage
    chat/          MessagesPage
```

- **Modal:** yagona `Modal` komponenti (o'lcham, sarlavha, footer). Modal holati brauzer tarixining `state` qismida (`{ modal: { task: 12 } }`), manzil satri toza qoladi (foydalanuvchi talabi). Sahifa ro'yxat bo'lib qoladi, ustida modal ochiladi; brauzer "Orqaga" tugmasi modalni yopadi, sahifa yangilansa modal qayta ochiladi. Eski `?task=12` havolalar modalni ochib, manzilni tozalaydi. Modal ustida modal ochilmaydi.
- **Ruxsatlar frontendda** faqat tugmalarni ko'rsatish/yashirish uchun; haqiqiy tekshiruv serverda.
- **Matnlar** `shared/text.ts` da; kodda qattiq yozilmaydi.
- **Holat/rang tokenlari** bitta joyda: `styles.css` va `status.ts`.

## 9. Xavfsizlik

- Parollar Django hesh mexanizmi (PBKDF2). Ro'yxatdan o'tganlar tasdiqlanmaguncha `is_active=False`.
- CSRF himoyasi yoqilgan (sessiya). Cookie: `HttpOnly`, `SameSite=Lax`. `CSRF_TRUSTED_ORIGINS` 5173 va 8020 portlar uchun sozlangan.
- Fayl: kengaytma ro'yxati (`.docx .pdf .png .jpg`), hajm chegarasi (20 MB), fayl nomi tozalanadi, `MEDIA` faqat autentifikatsiyalangan foydalanuvchiga `/api/files/...` orqali ruxsat tekshiruvi bilan beriladi (to'g'ridan-to'g'ri URL bilan emas).
- Brute-force: login urinishlariga throttle.
- Har bir API'da rol va egalik tekshiruvi; xato xabarlarida ma'lumot sizib chiqmaydi.
- Sirlar (`SECRET_KEY`) muhit o'zgaruvchisida, `DEBUG` prod'da o'chiq.

## 10. Testlash

| Daraja | Nima |
|---|---|
| workflow | Har bir ruxsat etilgan/taqiqlangan o'tish |
| permissions | Rol × resurs jadvali |
| services | approve/reject/versiya qoidasi, loyihani buyurtmadan yaratish, submit/review |
| api | Rol bo'yicha 403/404, ro'yxatda begona ma'lumot yo'qligi, N+1 |
| frontend | Vitest + jsdom + Testing Library (`src/test/`): filtrlar, vazifa modali (ish jurnali), xodim oynasi, chat, takliflar; doska sudrash qoidalari |

## 11. Qabul qilingan qarorlar (ochiq savollarga)

| Savol | Qaror | Nima uchun |
|---|---|---|
| Mutaxassisliklar ro'yxati | Admin boshqaradigan `Specialty` jadvali | Kod o'zgartirmasdan ro'yxat o'zgaradi |
| Autentifikatsiya | Sessiya + CSRF | 2-bo'lim |
| Fayl turlari | `.docx .pdf .png .jpg`, 20 MB | Xavfsizlik, TZ asosan Word |
| Papka tuzilmasi | `backend/`, `frontend/`, `docs/` | Ikkalasi mustaqil qurilsin |
| "Muddati buzib bajarilgan" | `completed_at > due_at` | Sodda, hisoblanadi |
| Takliflar va xabarlar | Alohida app va ro'yxat API'lari | Takliflar boshliq qarori bilan, xabarlar esa serializer va servis qatlamlari bilan himoyalangan |
| Boshqarma yon paneli | Buyurtmalarim, Bildirishnomalar | Talab bo'yicha minimal, o'zgartirish mumkin |

## 12. Bosqichlar

1. Backend skelet, modellar, Django admin ✅ (2026-09-28)
2. Auth: ro'yxatdan o'tish, login, tasdiqlash, ruxsatlar ✅ (2026-09-28)
3. Orders/Projects/Tasks servislari va API ✅ (2026-09-28)
4. Frontend asosi (tokenlar, layout, Modal) va sahifalar ✅ (2026-09-28)
5. Word ko'rish, fayllar, bildirishnomalar, dashboard, testlar ✅ (2026-09-28)
