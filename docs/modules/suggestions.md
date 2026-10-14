# Modul: suggestions

**Vazifasi:** takliflar, ovoz berish, Boshliq qarori.

**Fayllar:** `models.py`, `workflow.py`, `services.py`, `serializers.py`, `api.py`, `admin.py`.

## Modellar
`Suggestion` (`title`, `body`, `is_anonymous`, `author`, `status`, `boss_note`, `decided_by/at`), `SuggestionVote` (`suggestion`, `voter`, `kind`).

## Holat mashinasi (`workflow.py`)
`pending → accepted` va `pending → rejected` — faqat Boshliq.

## Ruxsat
O'chirish: faqat o'zi yozgan va anonim bo'lmagan taklifni (`services.py`). Qaror: faqat Boshliq (`workflow` + servis). Ro'yxat tartibi aniq: `order_by("-created_at", "-id")` (sahifalashda takror bo'lmasin; `SuggestionListOrderTests`).

## API
`suggestions/` router: `list`, `create`, `retrieve`, `destroy`, `vote`, `remove_vote`, `decide` — `../api.md`.

## Bog'liqlik
`accounts`, `core`.

## Testlar
`apps/suggestions/tests/test_api.py`.
