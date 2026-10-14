# Hozirgi holat

> Sessiya boshida shu faylni o'qi, oxirida yangila. Oxirgi yangilanish: 2026-10-14.

## Bajarilgan: AI development workflow (ADR 0008)

- Branch: `docs/ai-dev-workflow` (`feat/developer-portfolio` uchidan, 3715c73). Holat: **commit qilingan, push qilinmagan**; foydalanuvchi ko'rib chiqishi kutilmoqda.
- Qilingan: `CLAUDE.md` qisqartirildi, `docs/decisions/requirements-log.md`, `docs/README.md`, `docs/api.md`, `docs/modules/*` (11 ta), ADR 0001–0008, `tasks/`, `scripts/verify.ps1`, `.claude/settings.json`, `GEMINI.md` sinxronlandi, `.github/pull_request_template.md`.
- Tekshiruv: `scripts/verify.ps1` 2026-10-14 da to'liq o'tdi — backend 341 test (2 skipped), migratsiya mosligi toza, TypeScript, frontend 31 fayl / 134 test, build.
- Tekshirilmagan: `.claude/settings.json` deny qoidalari amalda bloklashi (sessiya qayta ochilgandan keyin tekshiriladi); `modules/*` va `api.md` ning "servisda tekshiriladi" izohlari kodni to'liq o'qib emas, `api.py`/`workflow.py`/`permissions.py` bo'yicha yozilgan.

## Keyingi qadam

1. Foydalanuvchi `docs/ai-dev-workflow` branchini ko'rib chiqadi (`git diff feat/developer-portfolio..docs/ai-dev-workflow --stat`).
2. Tasdiqlansa — `feat/developer-portfolio` ga merge/PR (push — ruxsat bilan). `B-034` (main 21 commit orqada) bilan birga hal qilinadi.
3. Keyin `tasks/backlog.md` dan keyingi vazifani foydalanuvchi tanlaydi.

## Bloklovchilar / ochiq qarorlar

- B-034: `main` ga merge strategiyasi (foydalanuvchi qarori).
- B-001…B-004: portfolio savollari (foydalanuvchi javobi).
- Yangi worktree `origin/main` dan ochiladi (eski kod) — yangi ishda `feat/developer-portfolio` uchidan boshlash kerak (`worktree.baseRef: head` sozlamasi yoki qo'lda `git reset`). Bu sessiyada qo'lda qilindi.
