# Modul: projects

**Vazifasi:** loyiha, jamoa, fayllar, yakunlash jarayoni (dasturchilar → PM → boshqarma).

**Fayllar:** `models.py`, `workflow.py`, `permissions.py`, `services.py`, `serializers.py`, `api.py`, `admin.py`.

## Modellar
`Project` (`code` — qo'lda kiritiladigan unikal loyiha raqami; `order` OneToOne, ixtiyoriy), `ProjectMember`, `ProjectCompletionAck` (dasturchi yakunlashga roziligi), `ProjectFile`. `Project.completion_requested_at` — faol so'rov davri.

## Daraja (Stage) o'tishlari (`workflow.py`)
`planned`, `started`, `needs_fix`, `rejected`, `pending_approval`, `done`. PM/Boshliq `planned/started/needs_fix` orasida erkin va ulardan `done` yoki `pending_approval` ga o'tkaza oladi (buyurtma bor-yo'qligiga qarab `services.py` tanlaydi); `pending_approval → done/rejected` faqat Boshqarma. `done` holati boshqasiga o'zgarmaydi.

## Yakunlash tartibi (muhim)
1. PM/Boshliq yakunlashni so'raydi (izoh + fayl).
2. Loyihadagi faol dasturchilardan "Ha, roziman" / "Yo'q" so'raladi. Hamma rozi bo'lgach PMga xabar boradi va "Yakunlash" ochiladi (avtomatik yakunlanmaydi).
3. Buyurtmasiz loyiha — PM yakunlaydi. Buyurtmali — `pending_approval`, so'ng buyurtmani yuborgan boshqarma tasdiqlaydi/rad etadi.
Qoida bitta joyda: `workflow.py: pending_acks`, `completion_locked`; servis `services.py: ensure_open`, `_apply_stage`, `ack_completion`. Yakunlangan yoki tasdiq kutayotgan loyihada vazifa/ijrochi biriktirish serverda yopiq.

## Ruxsat
`visible_projects(user)`, `can_view_project`. Yaratish/tahrir/jamoa/fayl — `IsManager`; tasdiqlash/rad — `IsDepartment`.

## Bog'liqlik
`accounts`, `core`, `notifications`, `orders`. `tasks`, `portfolio`, `panel` buni import qiladi.

## Testlar
`apps/projects/tests/`: `test_api`, `test_calendar`, `test_completion_rules`, `test_members`.
