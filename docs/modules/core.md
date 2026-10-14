# Modul: core

**Vazifasi:** hamma app'lar ishlatadigan umumiy qatlam. Eng pastki qatlam — boshqa domen app'larni **statik import qilmaydi** (`apps.get_model` orqali).

**Fayllar va ma'nosi:**
| Fayl | Nima |
|---|---|
| `models.py` | `Comment`, `ActivityLog` (tarix) |
| `workflow.py` | `check_transition`, `allowed_targets`, `TransitionError` — holat jadvallari uchun umumiy tekshiruv |
| `services.py` | `log(actor, verb, message, target)` — tarixga yozish |
| `api_utils.py` | `IsManager`, `IsDepartment`, `require_manager`, `file_info`, `user_brief`, `avatar_url`, `api_exception_handler` |
| `authentication.py` | `SessionAuth` (DRF sessiya autentifikatsiyasi) |
| `pagination.py` | `BoundedPagination` |
| `codes.py` | vazifa kodi (tasodifiy 9 xonali, `generate_unique_code`), `resolve_code` (qidiruv); **loyiha raqami qo'lda kiritiladi**, aniq moslik bilan qidiriladi |
| `dates.py` | `ensure_not_past` — "o'tgan sana kiritilmaydi" qoidasi **bitta joyda** |
| `periods.py` | `period_starts`, `period_cards` — yil/oy/hafta boshlanishi |
| `files.py` | `validate_upload`, `UploadTo` — fayl turi va hajmi |
| `choices.py` | umumiy tanlovlar (`Priority`) |
| `health.py` | `live`, `ready` (`/healthz/*`) |
| `management/commands/seed_scale.py` | masshtab sinovi uchun ma'lumot (faqat sinov bazasida) |

**Qoidalar:** fayl validatsiyasi va sana qoidasi faqat shu yerda; app'lar chaqiradi, takrorlamaydi. Yangi umumiy yordamchi qo'shishdan oldin mavjudini tekshiring.

**Bog'liqlik:** hech kimni import qilmaydi (testlardan tashqari).

**Testlar:** `apps/core/tests/`: `test_workflow`, `test_codes`, `test_dates`, `test_files`, `test_periods`, `test_runtime`, `test_scale_seed`, `test_load_evidence`.
