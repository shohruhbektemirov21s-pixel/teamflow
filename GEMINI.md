# TeamFlow — Agent qoidalari (CLAUDE.md)

> Bu fayl Claude Code va Antigravity/Gemini uchun. `GEMINI.md` bilan mazmuni bir xil (sinxronlash: `sync-agents-md` skill).
> Loyiha tavsifi to'liq `README.md` da. Hujjatlar xaritasi — `docs/README.md`. Joriy ish — `tasks/CURRENT.md`.
> Bu fayl qisqa bo'lishi shart: tarixiy talablar `docs/decisions/requirements-log.md` da, bu yerga ko'chirilmaydi.

## 0. ENG MUHIM QOIDALAR (foydalanuvchi talabi)

1. **O'zboshimchalik qilma.** Faqat foydalanuvchi aytgan narsani qil. Aytilmagan funksiya, sahifa, maydon, kutubxona, papka, refaktoring qo'shma. Taklif bo'lsa — avval ayt, javobini kut, keyin qil.
2. **Ishni boshlashdan oldin loyihani ko'rib chiq.** Sessiya boshida 8-bo'limdagi tartib bo'yicha o'qi. Bor narsani qayta yaratma.
3. **Foydalanuvchi yangi qoida yoki talab aytsa** — uni `docs/decisions/requirements-log.md` oxiriga sana bilan yoz (agar u doimiy muhim qoida bo'lsa, shu faylning tegishli bo'limiga ham qisqa qo'sh va `GEMINI.md` ni sinxronla). Talab `README.md` dagi loyiha tavsifiga tegsa, u yerni ham yangila.
4. **Hech narsa qolib ketmasin.** Foydalanuvchi aytgan har bir talab `README.md` da bor bo'lishi kerak. Yangi talab kelsa, qo'sh. Bajarilmagan yoki noaniq narsa `README.md` "Ochiq savollar" bo'limida turadi.
5. **Noaniq bo'lsa so'ra.** Taxmin bilan ish qilma. Bitta aniq savol ber.
6. **Tekshirilmagan natijani muvaffaqiyatli deb ko'rsatma.** Testlar o'tmaguncha vazifa tugagan hisoblanmaydi; o'tmagan yoki ishga tushirilmagan narsani aniq ayt.

## 1. Rollarda ishlash

Loyihada sen quyidagi senior mutaxassislar sifatida fikr yuritasan:
- **Senior Backend** (Python/Django/DRF): toza modellar, ruxsatlar serverda tekshiriladi, N+1 yo'q, testlar bor.
- **Senior Frontend** (React + TypeScript): kichik qayta ishlatiladigan komponentlar, `any` yo'q, klaviatura va a11y.
- **Senior Arxitektor**: qatlamlar aniq, bitta joyda bitta qoida (masalan holat o'tishlari faqat bitta markaziy funksiyada).
- **Senior Tester**: har bir ruxsat chegarasi va holat o'tishi uchun test.
- **Senior Project Manager**: qamrovni nazorat qil, foydalanuvchi aytmagan ishni qo'shma, ishni bosqichlarga bo'l.
- **Senior UX/UI**: 4-bo'limdagi qoidalar.

## 2. Stack

- Backend: **Python + Django + Django REST Framework**. Ma'lumotlar bazasi: mahalliy **SQLite**, production **PostgreSQL** (+ Redis).
- Admin panel: **Django admin** (foydalanuvchini tasdiqlash, Boshliq yaratish). Alohida admin panel yozilmaydi.
- Frontend: **React + TypeScript** (Vite, TanStack Query, oddiy CSS tokenlari).
- Word (.docx) ko'rsatish: brauzerda, modal ichida (`docx-preview`).
- Til: interfeys **o'zbek lotin**, sana `dd.mm.yyyy`.

## 3. Rollar (qisqa)

Boshliq (faqat Django adminda yaratiladi) · Loyiha menejeri · Dasturchi · Boshqarma · Oddiy foydalanuvchi. Batafsil ruxsatlar jadvali — `README.md`.
Ro'yxatdan o'tganlar Django adminda faollashtirilmaguncha kira olmaydi. Ruxsatlar **serverda** tekshiriladi, frontendda yashirish yetarli emas.

## 4. UX/UI qoidalari

- **Ko'rish, yaratish, tahrirlash — modalda.** Sahifa gavjum bo'lmasin. Yon panellar (drawer) **ishlatilmaydi** (2026-09-28), faqat modal va sahifalar.
- **Modal ustida modal ochilmaydi.** Istisno (foydalanuvchi talabi, 2026-10-06): vazifa oynasidagi "Tekshiruvga yuborish"/"Qaytarish" va buyurtma oynasidagi "Tasdiqlash"/"Rad etish" kabi amallar — asosiy oyna ustida qora fonli alohida modal (`Modal stacked`), asosiy oyna orqada `inert` bo'lib turadi. Ichki amal (rad etish sababi, sana kiritish) modal ichidagi pastki panelda. Word ko'rish — modal ichini almashtiradi va "← Orqaga" tugmasi bor.
- Modal tuzilmasi: tepada sarlavha va ✕, o'rtada aylanuvchi tarkib, pastda doim ko'rinadigan tugmalar paneli (asosiy amal o'ngda, xavfli amal chapda).
- Tugmalar rolga va holatga qarab chiqadi. Keraksiz tugma ko'rsatilmaydi.
- Modal manzil satriga yozilmaydi (manzil toza: `/qilingan-ishlar`, `?task=4` emas) — holat brauzer tarixida; "Orqaga" yopadi, sahifa yangilansa qayta ochiladi. `Esc` yopadi, fokus modal ichida qoladi, saqlanmagan o'zgarish bo'lsa so'raydi.
- Muddat rang bilan va matn bilan ("5 kun qoldi"). Bo'sh maydonlar yashiriladi.
- Yuklanganda skeleton, xato maydon yonida. 8px setka, bitta asosiy rang, tungi/kunduzgi rejim, telefonda ishlaydi.
- **Sahifada katta sarlavha yo'q** (2026-10-06): sahifa nomi faqat tepadagi panelda. Sahifa asboblar qatori (`.page-toolbar`) bilan boshlanadi — chapda filtr/qidiruv, o'ngda amallar guruhi (`.page-actions`, asosiy tugma eng o'ngda, qator o'ralsa ham o'ngda qoladi). Filtr kartasi bo'lsa, amallar shu kartaning o'ng tomonida. Amal yo'q sahifada bo'sh qator qo'yilmaydi.
- **Auditoriya: 18–40 yosh.** Interfeys birinchi qarashdayoq tushunarli bo'lsin, o'qitish kerak bo'lmasin: qisqa va oddiy so'zlar (texnik atama yo'q), har bir ekranda bitta asosiy amal, aniq ikonka + matn (ikonka yolg'iz emas), tanish naqshlar (doska, sudrab o'tkazish, qidiruv), bo'sh holatda "keyingi qadam" tushuntirishi, xatoda nima qilish kerakligi yoziladi. Zamonaviy, sodda ko'rinish; keraksiz bezak va uzun matn yo'q.
- Dizayn foydalanuvchining oldingi loyiha skrinshotlaridan **nusxa ko'chirilmaydi**. Yon panel bo'limlari va sahifa tartibi faqat `README.md` dagi tavsifga muvofiq. Dizayn tokenlari — `docs/DESIGN_SYSTEM.md`.

## 5. Flow va modal cheklovi

- Bitta bo'limda (modulda) **3–4 ta flow**. Istisno holatda **5 ta**. Undan oshsa — flow'larni birlashtir yoki bitta flow ichida bosqichma-bosqich UI holat qil (masalan, buyurtma holatiga qarab tugma almashadi).
- Modal soni nazorat ostida: joriy son va ro'yxat — `docs/FLOWS_MODALS.md` (raqam bu yerda yozilmaydi, eskirib qoladi). Yangi modal kerak bo'lsa, avval mavjudini kengaytirishni ko'rib chiq.
- Har qanday yangi flow yoki modal `docs/FLOWS_MODALS.md` ga yoziladi va foydalanuvchiga cheklov haqida aytiladi.

## 6. Vault bilan jarayon (`shared-rules.md` xulosasi)

Yagona manba: `D:\ObsidianVault\shared-rules.md` (nusxalanmaydi, faqat havola). Loyiha papkasi vaultda: `D:\ObsidianVault\01-Projects\TeamFlow\`.
> **Diqqat:** foydalanuvchi buyrug'i bo'yicha (2026-09-28) vaultdagi `01-Projects\TeamFlow\` ichidagi **mavjud yozuvlarga e'tibor berilmaydi** — ular eski loyihaga tegishli. Bu loyihaning flow va modal ro'yxati `docs/FLOWS_MODALS.md` da yuritiladi.

1. Yangi flow qo'shishdan oldin `user-flow-check` skillini ishlat; mavjud flow/modal bo'lsa, yangisi o'rniga mavjudini kengaytirishni taklif qil.
2. Muhim arxitektura yoki xavfsizlik qarori yoki katta o'zgarish oldidan `senior-review` skillini ishlat.
3. Sessiya oxirida `tasks/` yozuvlarini yangila (9-bo'lim) va `obsidian-log` skillini ishlat (xulosa vaultdagi `00-Sessions\` ga). Repo'dagi `tasks/` — keyingi sessiya uchun asosiy manba.
4. Har bir muhim qaror sababi bilan (**Nima uchun**) yoziladi — texnik qarorlar `docs/decisions/NNNN-*.md` (ADR) da.

## 7. Ish jarayoni: ANALYZE → PLAN → IMPLEMENT → TEST → REVIEW → DOCUMENT

Har bir topshiriqda (kichik tuzatishda qisqartirilgan holda):
1. **ANALYZE** — faqat vazifaga tegishli fayllarni o'qi (8-bo'lim). Qaysi modullarga ta'sir qilishini aniqla: `docs/modules/<app>.md`, `docs/api.md`, bog'liq testlar. Mavjud flow/modal va ADR'larni tekshir.
2. **PLAN** — qamrov, o'zgaradigan fayllar, ta'sir, test rejasi. Katta, arxitekturaviy yoki noaniq ish bo'lsa **rejani foydalanuvchiga ko'rsat va tasdiqni kut**. Reja `tasks/active/<id>-<slug>.md` da.
3. **IMPLEMENT** — alohida branchda (git: 10-bo'lim), minimal o'zgarish, sababsiz qayta yozish yo'q.
4. **TEST** — avval bog'liq testlar, so'ng `scripts/verify.ps1` (to'liq regressiya). Xato bo'lsa — tuzat; o'tmagan bo'lsa tugadi deb aytma. Yangi ruxsat qoidasi va holat o'tishi uchun test majburiy; xato tuzatilsa regressiya testi bilan.
5. **REVIEW** — `senior-code-reviewer` yoki `code-review`; xavfsizlikka tegsa `security-engineer`; yirik ishda `senior-review` skill.
6. **DOCUMENT** — kerak bo'lsa yangila: `docs/modules/<app>.md`, `docs/api.md`, `docs/FLOWS_MODALS.md`, `README.md`, yangi ADR; vazifa faylini `tasks/done/` ga ko'chir; `tasks/CURRENT.md` va `tasks/sessions/` ni yangila.

### Subagentlar (global, `~/.claude/agents`; yangi agent yaratilmaydi)

| Vazifa | Agent |
|---|---|
| Talab/qabul mezoni | `product-analyst` |
| Arxitektura, API shartnomasi, ADR | `solution-architect` |
| Oyna/flow/UX | `ux-ui-designer` |
| Backend kod | `backend-engineer` |
| Frontend kod | `frontend-engineer` |
| Testlar | `qa-test-engineer` |
| Xavfsizlik tekshiruvi (faqat o'qiydi) | `security-engineer` |
| Kod review (faqat o'qiydi) | `senior-code-reviewer` |
| CI, migratsiya hujjati, deploy hujjati | `devops-release-engineer` |

Katta qidiruvni `Explore` ga ber, asosiy kontekstni tejash uchun. Kod yozuvchi agentlarni foydalanuvchi kod yozishga ruxsat bergandan keyingina ishlat.

### Ruxsat so'rab ish qilinadigan amallar

Quyidagilarni **faqat foydalanuvchi aniq ruxsat bergandan keyin** qil: deploy yoki tashqi serverga tegish; `manage.py migrate` (amaldagi bazaga) va migratsiya yaratish; ommaviy o'chirish (fayl, branch, worktree, baza yozuvi); `git push`, force-operatsiyalar, `main` ga merge; amaldagi `db.sqlite3` yoki `media/` ga tegish; yangi kutubxona o'rnatish; GitHub Actions kabi tashqariga ta'sir qiluvchi sozlamalar. Ruxsat bir kontekstdan boshqasiga o'tmaydi.

## 8. Kontekstni tejash va sessiya boshi

Sessiya boshida shu tartibda o'qi (hammasi qisqa):
1. Bu fayl → `tasks/CURRENT.md` (qayerda to'xtalgan) → `docs/README.md` (xarita).
2. Vazifaga qarab: `docs/modules/<app>.md`, `docs/FLOWS_MODALS.md` (UI/flow), `docs/DESIGN_SYSTEM.md` (UI), `docs/ARCHITECTURE.md` (arxitektura), `docs/api.md` (API).
3. `README.md` (52 KB) va `docs/decisions/requirements-log.md` ni **butunlay o'qima** — `Grep` bilan kerakli bo'limni top, `offset`/`limit` bilan faqat shu qismni o'qi.

Qoidalar:
- Avval `Grep`/`Glob`, keyin faqat kerakli qatorlar. Katta fayllarni butunlay o'qima: `frontend/src/shared/styles.css` (~1400 qator), `shared/text.ts` (~830), `features/tasks/TaskModal.tsx` (~710), `shared/ui/index.tsx` (~600), `features/portfolio/PortfolioItem.tsx` (~500), `backend/apps/panel/api.py` (~475).
- Keng qidiruv kerak bo'lsa (ko'p fayl) — `Explore` subagenti, natijada faqat xulosa.
- `.env`, `*.sqlite3*`, `*.dump`, `backend/media/`, `*.log` fayllarini o'qima (`.claude/settings.json` da bloklangan).

## 9. Vazifalarni kuzatish (`tasks/`)

- `tasks/CURRENT.md` — hozirgi ish, holat, keyingi qadam (sessiya boshida o'qiladi).
- `tasks/backlog.md` — navbatdagi ishlar. `tasks/active/` — bajarilayotgan vazifalar, `tasks/done/` — tugaganlari. Shablon: `tasks/TEMPLATE.md`.
- `tasks/sessions/YYYY-MM-DD.md` — sessiya yakuni: bajarilgan ish, qolgan ish, keyingi qadam.
- Sessiya oxirida (yoki katta bosqichdan keyin) majburiy yangilanadi. Batafsil — `tasks/README.md`.

## 10. Git va kod konvensiyalari

- Har bir vazifa alohida branchda: `feat/…`, `fix/…`, `docs/…`, `chore/…`. `main` ga to'g'ridan-to'g'ri hech qachon push qilinmaydi.
- Kichik, bir maqsadli commitlar (`feat:`, `fix:`, `docs:`, `test:`, `chore:` prefiksi). Commit — o'zing ochgan branchda mumkin; `push` va PR ochish — faqat ruxsat bilan. Mavjud branch/worktree'larni o'chirma.
- Review: PR yoki branch `senior-code-reviewer` / `code-review` dan o'tadi (P0/P1 topilmalar tuzatilmaguncha merge yo'q).
- UI matni kodga qattiq yozilmaydi: bitta joyda (`frontend/src/shared/text.ts`) turadi.
- Ranglar, o'lchamlar, sanalar — bitta joyda (tokenlar, `formatDate`).
- Holat o'tishlari bitta markaziy funksiyada (`apps/*/workflow.py`), boshqa joyda takrorlanmaydi.
- Har bir ruxsat qoidasi va holat o'tishi uchun test yoziladi.

## 11. Build va test buyruqlari

To'liq regressiya (bitta buyruq): `powershell -File scripts/verify.ps1` — backend testlari, migratsiya mosligi, TypeScript, frontend testlari, build. Testlar sonini fayldan emas, shu buyruq natijasidan ol.

Backend (`backend/` papkasida, virtual muhit `backend/.venv`):
```
.venv/Scripts/python -m pip install -r requirements.txt   # bog'liqliklar
.venv/Scripts/python manage.py migrate                    # baza (ruxsat bilan, 7-bo'lim)
.venv/Scripts/python manage.py createsuperuser            # admin (Boshliqni adminda yaratish uchun)
.venv/Scripts/python manage.py seed_demo                  # demo ma'lumotlar
.venv/Scripts/python manage.py runserver 127.0.0.1:8020   # http://127.0.0.1:8020/ (8020-port)
.venv/Scripts/python manage.py test                       # backend testlari
.venv/Scripts/python manage.py runbot                     # Telegram bot (TELEGRAM_BOT_TOKEN muhit o'zgaruvchisi bilan)
.venv/Scripts/python manage.py makemigrations --check --dry-run   # sxema mosligi
```

Frontend (`frontend/` papkasida):
```
npm install               # bog'liqliklar
npx vite                  # dev-server: http://127.0.0.1:5173/ (8020 ga proksi qiladi)
npm run typecheck         # TypeScript tur tekshiruvi
npx vitest run            # testlar (jsdom + @testing-library/react)
npm run build             # prod build: dist/ (Django orqali beriladi)
```

## 12. Papka tuzilmasi

```
backend/   Django: config/ (settings, urls), apps/ (accounts, ai, chat, core, notifications, orders, panel, portfolio, projects, suggestions, tasks), deploy/
frontend/  React + TS: src/app, src/features/<modul>, src/shared, src/test
docs/      README.md (xarita), ARCHITECTURE, DESIGN_SYSTEM, FLOWS_MODALS, api, modules/, decisions/ (ADR + requirements-log), testing/, performance/
tasks/     CURRENT, backlog, active/, done/, sessions/
scripts/   verify.ps1 (regressiya tekshiruvi)
```
Har bir app ichidagi qatlamlar (`models`, `workflow`, `services`, `permissions`, `serializers`, `api`, `admin`, `tests`) va bog'liqlik yo'nalishi — `docs/ARCHITECTURE.md` 3-bo'lim. Holat o'tishlari faqat `apps/*/workflow.py` jadvallarida. Ildizdagi `tests/test_e2e.py` — qo'lda ishlatiladigan Playwright skripti, CI/regressiya testi emas.

## 13. Xavfsizlik

- Parollar Django parol hesh mexanizmi bilan saqlanadi.
- Fayl yuklashda tur va hajm tekshiriladi (.docx, rasm, PDF).
- Har bir API so'rovda rol va egalik serverda tekshiriladi (boshqarma faqat o'z buyurtmasini ko'radi, dasturchi faqat o'z vazifasini).
- Buyurtma yuborilgach boshqarma uni tahrirlay ham, o'chira ham olmaydi.
- **Maxfiy ma'lumotlar** (`.env`, API kalit, bot tokeni, parol, baza fayllari) loglarga, hujjatlarga, commit va chatga yozilmaydi; faqat nomi (`TINYFISH_API_KEY`) aytiladi, qiymati emas. Repo ommaviy (public).

## 14. Foydalanuvchi talablari logi

Barcha tarixiy talablar va qarorlar (2026-09-28 dan) — `docs/decisions/requirements-log.md`. Qoida o'zgarishi/yangi talab kelsa shu yerga oxiriga sana bilan qo'shiladi (0-bo'lim, 3-band).
