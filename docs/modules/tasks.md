# Modul: tasks

**Vazifasi:** vazifa, ijrochilar, topshiriqlar (sub-vazifa), topshirish va tekshiruv, ish jurnali, ommaviy yaratish.

**Fayllar:** `models.py`, `workflow.py`, `permissions.py`, `filters.py`, `services.py`, `serializers.py`, `api.py`, `admin.py`.

## Modellar
`Task` (`code` — avtomatik tasodifiy 9 xonali, unikal), `TaskAssignment` (ko'p ijrochi), `SubTask` (`assignees` M2M; UI da "Topshiriq"), `TaskFile`, `Submission` + `SubmissionFile`, `WorkLog`.

## Holat mashinasi (`workflow.py`)
`control → in_progress` (dasturchi/PM/Boshliq) · `in_progress → in_review` (faqat biriktirilgan dasturchi) · `in_review → done` (PM/Boshliq qabul) · `in_review → in_progress` (PM/Boshliq qaytarish). Dasturchi to'g'ridan-to'g'ri `done` qila olmaydi.

## Ruxsat (`permissions.py`)
`visible_tasks`, `listed_tasks` (dasturchi ro'yxatda faqat o'z vazifasini ko'radi — Ctrl K qidiruvi ham shundan), `is_assignee`, `can_manage_assignees`, `can_manage_subtasks`, `can_work_on`. Ro'yxat qoidalari bitta joyda; bosh panel hisobi ham `listed_tasks` dan.

## API
`TaskViewSet` (`tasks/`) + `projects/setup/` (loyiha + jamoa + vazifalar bitta tranzaksiyada) — `../api.md`. `?all=1` doska/taqvim uchun sahifalamaydi (chegaralangan).

## Muhim qoidalar
- Muddat/boshlanish o'tgan sana bo'lmaydi (`core/dates.py`).
- Qisman kod qidiruvi (1–2 raqam ham) `filters.py` da; regressiya testi: `tests/test_api.py` → `DashboardTests.test_task_list_searches_one_or_two_digit_code_fragments`.
- Ijrochi jamoada bo'lmasa loyiha jamoasiga avtomatik qo'shiladi.
- Yakunlangan/tasdiq kutayotgan loyihada vazifa qo'shish yopiq (`projects` modulidagi `ensure_open`).
- Katta fayllar: `services.py` (~390 qator), `TaskModal.tsx` (frontend, ~710 qator) — butunlay o'qimang.

## Bog'liqlik
`accounts`, `core`, `notifications`, `orders`, `projects`. `portfolio`, `panel` buni import qiladi.

## Testlar
`apps/tasks/tests/`: `test_workflow`, `test_api`, `test_assignees`, `test_bulk`, `test_concurrency`, `test_project_setup`, `test_worklogs`.
