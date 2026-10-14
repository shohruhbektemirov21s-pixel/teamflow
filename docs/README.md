# TeamFlow — Hujjatlar xaritasi

> Maqsad: agent yoki yangi dasturchi **butun hujjatni o'qimasdan** kerakli joyni topsin. Avval shu fayl, keyin faqat vazifaga tegishli hujjat.
> Qoidalar — `../CLAUDE.md`. Hozirgi ish — `../tasks/CURRENT.md`.

## Qaysi vazifa uchun nimani o'qish

| Vazifa | O'qiladi (shu tartibda) |
|---|---|
| Backend: yangi endpoint yoki o'zgarish | `modules/<app>.md` → `api.md` → `ARCHITECTURE.md` §3 (qatlamlar) |
| Backend: holat o'tishi / ruxsat | `modules/<app>.md` → `apps/<app>/workflow.py` va `permissions.py` |
| Frontend: yangi oyna, flow, sahifa | `FLOWS_MODALS.md` → `DESIGN_SYSTEM.md` → `../CLAUDE.md` §4–5 |
| Ma'lumotlar bazasi / migratsiya | `ARCHITECTURE.md` §4 → `modules/<app>.md` → ruxsat so'ra (`CLAUDE.md` §7) |
| Xavfsizlik | `ARCHITECTURE.md` §9 → `../CLAUDE.md` §13 → `modules/accounts.md`, `modules/core.md` |
| Ishlash tezligi, masshtab | `ARCHITECTURE.md` §3.1 → `performance/` → `../backend/deploy/README.md` |
| Texnik qaror nega shunday | `decisions/README.md` (ADR indeksi) |
| Foydalanuvchi qachon nima so'ragan | `decisions/requirements-log.md` (katta — `Grep` bilan qidiring) |
| Mahsulotning to'liq tavsifi | `../README.md` (52 KB — `Grep` bilan bo'lim toping) |

## Hujjatlar ro'yxati

| Fayl | Mazmuni | Yangilanadi qachon |
|---|---|---|
| `ARCHITECTURE.md` | Qatlamlar, ma'lumotlar modeli, holat mashinalari, xavfsizlik, masshtab | Arxitektura o'zgarganda |
| `api.md` | Barcha `/api/` marshrutlari (kod bilan solishtirilgan) | Endpoint qo'shilsa/o'zgarsa/o'chsa |
| `modules/<app>.md` | Har bir Django app: vazifa, modellar, API, ruxsat, bog'liqlik, testlar | App ichida muhim o'zgarish bo'lsa |
| `FLOWS_MODALS.md` | Flow va modal reestri, cheklov (3–4 flow/bo'lim) | Yangi flow/modal qo'shilsa |
| `DESIGN_SYSTEM.md` | Dizayn tokenlari va komponent qoidalari | UI tokenlar o'zgarsa |
| `decisions/` | ADR (texnik qarorlar) va `requirements-log.md` (foydalanuvchi talablari) | Qaror/talab kelsa — oxiriga qo'shiladi |
| `testing/*.tdd.md` | Alohida funksiyalar uchun test rejalari (tarixiy) | Yangi katta funksiya testlari |
| `performance/`, `scratch/` | O'lchov hisobotlari (tarixiy, o'zgartirilmaydi) | — |
| `PROJECT_PROMPT_UZ.md` | Dastlabki loyiha briefi (tarixiy) | — |

## Hujjat yuritish qoidalari

1. **Bir fakt — bir joyda.** Raqamlar (test soni, modal soni) qo'lda yozilmaydi: ularni `scripts/verify.ps1` natijasi va `FLOWS_MODALS.md` beradi.
2. **Kodga qarab yoz.** Hujjatga yozishdan oldin kodni tekshir; tekshirilmagan narsa "tekshirilmagan" deb belgilanadi.
3. **Maxfiy qiymat yo'q.** `.env` qiymatlari, tokenlar, parollar hujjatga yozilmaydi — faqat o'zgaruvchi nomi.
4. **Til:** o'zbek lotin. Kod identifikatorlari inglizcha qoladi.
5. **Katta fayllarni bo'l:** hujjat ~300 qatordan oshsa, mavzu bo'yicha ajrat va shu xaritaga qo'sh.
