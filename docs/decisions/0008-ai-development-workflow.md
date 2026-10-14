# 0008 — AI development workflow (CLAUDE.md, docs/, tasks/)

- Holat: Qabul qilingan
- Sana: 2026-10-14
- Manba: foydalanuvchi talabi va tasdig'i (2026-10-14); audit natijasi

## Kontekst
`CLAUDE.md` 51 KB edi (hajmning ko'pi §13 changelog), `GEMINI.md` shuning nusxasi; test/modal raqamlari eskirgan; `tasks/`, API/modul hujjatlari, ADR, CI va regressiya skripti yo'q edi. Agent har sessiyada bir necha o'n ming token o'qiyotgan edi.

## Qaror
- `CLAUDE.md` qisqa qoidalar to'plami; tarixiy talablar `docs/decisions/requirements-log.md` ga so'zma-so'z ko'chirildi.
- `docs/README.md` — xarita; `docs/modules/`, `docs/api.md`, `docs/decisions/` (ADR).
- `tasks/` — `CURRENT`, `backlog`, `active/`, `done/`, `sessions/`.
- Jarayon: ANALYZE → PLAN → IMPLEMENT → TEST → REVIEW → DOCUMENT; katta ishda PLAN'dan keyin tasdiq.
- Regressiya: `scripts/verify.ps1` (bitta buyruq). Yangi subagent/skill yaratilmadi (global 10 agent yetarli).
- `.claude/settings.json`: maxfiy va baza fayllarini o'qishni bloklash.

## Nima uchun
Kontekst isrofini kamaytirish, sessiyalar orasida izchillik, tekshirilmagan natijani "muvaffaqiyatli" deb ko'rsatmaslik.

## Oqibatlar
Raqamlar (test, modal soni) hujjatlarda qo'lda yozilmaydi. `GEMINI.md` `CLAUDE.md` nusxasi bo'lib qoladi (`sync-agents-md`). CI (GitHub Actions), lint (ruff/eslint) va `AGENTS.md` ataylab qo'shilmadi — kerak bo'lsa alohida qaror bilan.
