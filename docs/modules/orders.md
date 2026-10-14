# Modul: orders

**Vazifasi:** Boshqarma yuboradigan buyurtma (TZ) va uning versiyalari; PM/Boshliq tasdiqlaydi yoki rad etadi.

**Fayllar:** `models.py`, `workflow.py`, `permissions.py`, `filters.py`, `services.py`, `serializers.py`, `api.py`, `admin.py`.

## Modellar
- `Order` — nom, izoh, muhimlik, so'ralgan muddat, yuborgan (boshqarma), holat, tasdiqlagan, sanalar, PM izohi.
- `OrderVersion` — TZ fayli versiyasi (`unique(order, number)`), qarori (kutilmoqda/tasdiq/rad), rad sababi.

## Holat mashinasi (`workflow.py: TRANSITIONS`)
`submitted → approved` (PM/Boshliq) · `submitted → rejected` (PM/Boshliq) · `rejected → submitted` (Boshqarma, yangi TZ versiyasi) · `approved → project_created` (PM/Boshliq).

## Ruxsat
`visible_orders(user)` / `can_view_order` — boshqarma faqat o'z buyurtmasini ko'radi. Yaratish: `IsDepartment`. Yuborilgach boshqarma tahrirlay/o'chira olmaydi (faqat yangi versiya qo'shadi). `dates/` — `require_manager`.

## API
`orders/` router: `list`, `create`, `retrieve`, `versions`, `approve`, `reject`, `dates` — `../api.md`.

## Muhim qoidalar
- Muddat (`requested_due_date`) bugundan oldin bo'lmaydi (`core/dates.py`); tasdiqlangan sana keyin o'tib ketsa ham loyiha yaratiladi.
- Buyurtma nomi/izohi bog'liq loyiha bilan ikki tomonlama sinxron (`requirements-log.md`, 2026-10-02).
- Loyiha yakunlash tasdig'i boshqarma tomonidan `OrderModal` orqali (`projects` moduli bilan birga).

## Bog'liqlik
`accounts`, `core`, `notifications`. `projects` buni import qiladi (teskarisi emas).

## Testlar
`apps/orders/tests/`: `test_workflow`, `test_api`, `test_dashboard`.
