# Backlog

> Hammasi **taklif/ochiq** — foydalanuvchi tanlamaguncha bajarilmaydi (`CLAUDE.md` §0.1). Manba har qatorda ko'rsatilgan.
> Ustuvorlik: P1 — tez, P2 — keyin, P3 — ixtiyoriy.

## Foydalanuvchi javobi kutilayotgan savollar

| ID | Mavzu | Manba |
|---|---|---|
| B-001 | Portfolioda dasturchining bajarilgan vazifa va loyiha nomlari barcha rollarga ochiq — shunday qolsinmi? | `README.md` §11 "Ochiq savollar" |
| B-002 | Baholash va kuzatish barcha rollarga ochiq (faqat o'zini emas) — tasdiqlansinmi? | `README.md` §11 |
| B-003 | Video chegarasi (100 MB, loyihaga 5 tagacha) to'g'rimi? | `README.md` §11 |
| B-004 | Oddiy o'rtacha reyting o'rniga "ishonchli reyting" (Bayes o'rtacha)? | `README.md` §11 |

## Xavfsizlik / operatsion (ruxsat so'rab ish qilinadi)

| ID | Ish | Ustuvorlik | Manba |
|---|---|---|---|
| B-010 | Amaldagi serverda `DEBUG`, standart `SECRET_KEY` va demo akkaunt parollari holatini tekshirish (CRITICAL deb belgilangan edi; hozirgi holat **tekshirilmagan**) | P1 | `requirements-log.md` 2026-10-02; vault review |
| B-011 | Production: haqiqiy server, TLS va SQLite → PostgreSQL ma'lumot o'tkazish hali bajarilmagan | P2 | `requirements-log.md` 2026-10-06; `backend/deploy/README.md` |
| B-012 | Tanlangan serverda capacity test qayta o'tkazish (eski 10k hisobot joriy sxemani qamramaydi) | P2 | `ARCHITECTURE.md` §3.1 |

## Texnik qarz va hujjat tuzatishlari

| ID | Ish | Ustuvorlik | Manba |
|---|---|---|---|
| B-020 | `README.md` §9/§10 sarlavhalari "16 ta", `FLOWS_MODALS.md` — 17 ta modal; birini tuzatish (qaysi biri haqiqiy ekanini kodga qarab aniqlash) | P3 | audit 2026-10-14 |
| B-021 | `accounts/serializers.py` dagi `portfolio`/`tasks` lazy importi qatlam qoidasidan istisno — chiqarib tashlash variantini ko'rib chiqish | P3 | `docs/modules/accounts.md` |
| B-022 | Git'da tracked, lekin yaratiladigan fayllar: `backend/server_debug.log` (bo'sh, 0 bayt) va `frontend/tsconfig.tsbuildinfo` (har `npm run build` da o'zgaradi, `.gitignore` da `*.tsbuildinfo` bor) — `git rm --cached` | P3 | audit 2026-10-14 |
| B-023 | Ildizdagi `tests/test_e2e.py` (qo'lda Playwright skripti, headed, `sleep`) va skrinshotlar — qoldirish, `scripts/`ga ko'chirish yoki avtomatlashtirish | P3 | audit 2026-10-14 |
| B-024 | Yakunlash flow'ining qolgan past ustuvorlik tavsiyalari: rad etilganda boshqa kutayotgan dasturchilarga xabar yo'qligi; tasdiq xabari so'ragan odamga; kesh poygasi; `_people_rows` hajmi; izoh servisi | P3 | `requirements-log.md` 2026-10-05, 2026-10-09 |
| B-025 | Katta fayllarni bo'lish (faqat kuzatuv): `panel/api.py`, `tasks/services.py`, `TaskModal.tsx`, `styles.css`, `text.ts` | P3 | `requirements-log.md` 2026-10-06 |

## Jarayon / asboblar (ataylab qo'shilmagan, kerak bo'lsa tasdiq bilan)

| ID | Ish | Izoh |
|---|---|---|
| B-030 | GitHub Actions CI (`scripts/verify.ps1` ekvivalenti) | Public repo'ga tashqi ta'sir qiladi — alohida tasdiq |
| B-031 | Lint/format (ruff, eslint) — avval "faqat hisobot" rejimida | Katta diff chiqarmaslik uchun |
| B-032 | `AGENTS.md` (Codex uchun `CLAUDE.md` ga havola) | Hozir Codex faqat `.codex/config.toml` orqali |
| B-033 | Eski worktree va branch'larni tozalash. Hisobot (2026-10-14, faqat o'qildi): 24 worktree (shu ishniki bilan). `origin/main` ga to'liq merge bo'lgan lokal branch'lar: `claude/loyihani-tuliq-kurib-run-84dc22`, `claude/mana-shuni-kurib-chiq-tuliq-cb4089`, `claude/vs-code-tuliq-ishga-tushir-67b226`, `remove-notifications-sidebar-link`, `worktree-board-projects-no-description`, `worktree-orders-table-no-description`, `worktree-project-cleanup-review`, `worktree-remove-page-headers`, `worktree-senior-review-fixes`, `worktree-submit-stacked-modal`. Qolganlari `main`ga merge **bo'lmagan** (ayrimlari `feat/developer-portfolio` ichida bo'lishi mumkin — tekshirilmagan). Ishlanmagan o'zgarishli (dirty) worktree'lar tekshirilmagan. | O'chirish — faqat ruxsat bilan |
| B-034 | `feat/developer-portfolio` `origin/main` dan 21 commit oldinda — asosiy ish `main`da emas (yangi worktree `origin/main` dan ochilgani uchun eski kodni beradi). **Tahlil (2026-10-14, faqat o'qish):** `main` (5f43605) — `feat/developer-portfolio` ning to'g'ridan-to'g'ri ajdodi (tarmoqlanish yo'q, fast-forward mumkin). Ochiq PR #10 (`main` ← `feat/completion-flow-and-perf`) boshi ham shu zanjirda: main → +2 commit (#10 boshi) → +19 commit → `feat/developer-portfolio`. `feat/developer-portfolio` uchun `main`ga PR yo'q. Ochiq PR'lar: #11 (`completion-flow` ← `scale-10k`, +2 commit dev-portfolio'da yo'q), #12 (`dev-portfolio` ← `fix/review-1-4-6`), #13, #14 (`fix/review-1-4-6` ga). **Tavsiya:** `main` ← `feat/developer-portfolio` PR'ni "Create a merge commit" bilan (squash emas — SHA'lar saqlansin, stacked PR #10–#14 bazalari buzilmasin; #10 o'zi merged bo'ladi), keyin `main` ← `docs/ai-dev-workflow`. Merge — foydalanuvchi qo'lida (`main`ga agent merge qilmaydi). | P1 — foydalanuvchi qarori |
