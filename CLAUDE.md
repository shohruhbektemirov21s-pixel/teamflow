# TeamFlow — Agent qoidalari (CLAUDE.md)

> Bu fayl Claude Code va Antigravity/Gemini uchun. `GEMINI.md` bilan mazmuni bir xil.
> Loyiha tavsifi to'liq `README.md` da. Ishni boshlashdan oldin uni o'qi.

## 0. ENG MUHIM QOIDALAR (foydalanuvchi talabi)

1. **"Boshla" degunicha kod yozma.** Foydalanuvchi aniq "boshla" demaguncha faqat muhokama, reja va hujjat. Fayl yaratish faqat hujjatlar uchun ruxsat etilgan.
2. **O'zboshimchalik qilma.** Faqat foydalanuvchi aytgan narsani qil. Aytilmagan funksiya, sahifa, maydon, kutubxona, papka, refaktoring qo'shma. Taklif bo'lsa — avval ayt, javobini kut, keyin qil.
3. **Ishni boshlashdan oldin loyihani ko'rib chiq.** Har sessiya boshida: `README.md`, shu fayl, `docs/FLOWS_MODALS.md` ni o'qi va kod bo'lsa mavjud tuzilmani ko'r. Bor narsani qayta yaratma.
4. **Foydalanuvchi yangi qoida yoki talab aytsa** — uni shu faylning **13-bo'limiga** (Foydalanuvchi qo'shimchalari) sana bilan yoz, `GEMINI.md` ga ham xuddi shuni ko'chir. Talab `README.md` dagi loyiha tavsifiga tegsa, u yerni ham yangila.
5. **Hech narsa qolib ketmasin.** Foydalanuvchi aytgan har bir talab `README.md` da bor bo'lishi kerak. Yangi talab kelsa, qo'sh. Bajarilmagan yoki noaniq narsa `README.md` "Ochiq savollar" bo'limida turadi.
6. **Noaniq bo'lsa so'ra.** Taxmin bilan ish qilma. Bitta aniq savol ber.

## 1. Rollarda ishlash

Loyihada sen quyidagi senior mutaxassislar sifatida fikr yuritasan:
- **Senior Backend** (Python/Django/DRF): toza modellar, ruxsatlar serverda tekshiriladi, N+1 yo'q, testlar bor.
- **Senior Frontend** (React + TypeScript): kichik qayta ishlatiladigan komponentlar, `any` yo'q, klaviatura va a11y.
- **Senior Arxitektor**: qatlamlar aniq, bitta joyda bitta qoida (masalan holat o'tishlari faqat bitta markaziy funksiyada).
- **Senior Tester**: har bir ruxsat chegarasi va holat o'tishi uchun test.
- **Senior Project Manager**: qamrovni nazorat qil, foydalanuvchi aytmagan ishni qo'shma, ishni bosqichlarga bo'l.
- **Senior UX/UI**: 4-bo'limdagi qoidalar.

## 2. Stack

- Backend: **Python + Django + Django REST Framework**. Ma'lumotlar bazasi: Django standart **SQLite**.
- Admin panel: **Django admin** (foydalanuvchini tasdiqlash, Boshliq yaratish). Alohida admin panel yozilmaydi.
- Frontend: **React + TypeScript**.
- Word (.docx) ko'rsatish: brauzerda, modal ichida (`docx-preview`).
- Til: interfeys **o'zbek lotin**, sana `dd.mm.yyyy`.

## 3. Rollar (qisqa)

Boshliq (faqat Django adminda yaratiladi) · Loyiha menejeri · Dasturchi · Boshqarma. Batafsil ruxsatlar jadvali — `README.md`.
Ro'yxatdan o'tganlar Django adminda faollashtirilmaguncha kira olmaydi. Ruxsatlar **serverda** tekshiriladi, frontendda yashirish yetarli emas.

## 4. UX/UI qoidalari

- **Ko'rish, yaratish, tahrirlash — modalda.** Sahifa gavjum bo'lmasin. Ro'yxat uchun yon panel (drawer), qaror qabul qilish uchun modal.
- **Modal ustida modal ochilmaydi.** Ichki amal (rad etish sababi, sana kiritish) modal ichidagi pastki panelda. Word ko'rish — modal ichini almashtiradi va "← Orqaga" tugmasi bor.
- Modal tuzilmasi: tepada sarlavha va ✕, o'rtada aylanuvchi tarkib, pastda doim ko'rinadigan tugmalar paneli (asosiy amal o'ngda, xavfli amal chapda).
- Tugmalar rolga va holatga qarab chiqadi. Keraksiz tugma ko'rsatilmaydi.
- Modal manzil satriga yozilmaydi (manzil toza: `/qilingan-ishlar`, `?task=4` emas) — holat brauzer tarixida; "Orqaga" yopadi, sahifa yangilansa qayta ochiladi. `Esc` yopadi, fokus modal ichida qoladi, saqlanmagan o'zgarish bo'lsa so'raydi.
- Muddat rang bilan va matn bilan ("5 kun qoldi"). Bo'sh maydonlar yashiriladi.
- Yuklanganda skeleton, xato maydon yonida. 8px setka, bitta asosiy rang, tungi/kunduzgi rejim, telefonda ishlaydi.
- **Auditoriya: 18–40 yosh.** Interfeys birinchi qarashdayoq tushunarli bo'lsin, o'qitish kerak bo'lmasin: qisqa va oddiy so'zlar (texnik atama yo'q), har bir ekranda bitta asosiy amal, aniq ikonka + matn (ikonka yolg'iz emas), tanish naqshlar (doska, sudrab o'tkazish, qidiruv), bo'sh holatda "keyingi qadam" tushuntirishi, xatoda nima qilish kerakligi yoziladi. Zamonaviy, sodda ko'rinish; keraksiz bezak va uzun matn yo'q.
- Dizayn foydalanuvchining oldingi loyiha skrinshotlaridan **nusxa ko'chirilmaydi**. Yon panel bo'limlari va sahifa tartibi faqat `README.md` dagi tavsifga muvofiq.

## 5. Flow va modal cheklovi

- Bitta bo'limda (modulda) **3–4 ta flow**. Istisno holatda **5 ta**. Undan oshsa — flow'larni birlashtir yoki bitta flow ichida bosqichma-bosqich UI holat qil (masalan, buyurtma holatiga qarab tugma almashadi).
- Modal soni ham nazorat ostida (hozir reja: 8 ta). Yangi modal kerak bo'lsa, avval mavjudini kengaytirishni ko'rib chiq.
- Har qanday yangi flow yoki modal `docs/FLOWS_MODALS.md` ga yoziladi va foydalanuvchiga cheklov haqida aytiladi.

## 6. Majburiy jarayon (vault bilan, `shared-rules.md` xulosasi)

Yagona manba: `D:\ObsidianVault\shared-rules.md` (nusxalanmaydi, faqat havola). Loyiha papkasi vaultda: `D:\ObsidianVault\01-Projects\TeamFlow\`.
> **Diqqat:** foydalanuvchi buyrug'i bo'yicha (2026-09-28) vaultdagi `01-Projects\TeamFlow\` papkasining ichidagi **mavjud yozuvlarga e'tibor berilmaydi** — ular eski TeamFlow loyihasiga tegishli. Ularni shu loyihaning flow/modal ro'yxati deb hisoblama va o'zgartirma. Bu loyihaning flow va modal ro'yxati `docs/FLOWS_MODALS.md` da yuritiladi.

1. Sessiya boshida `docs/FLOWS_MODALS.md` ni o'qi. Mavjud flow/modal bo'lsa, yangisini yaratish o'rniga mavjudidan foydalanishni taklif qil.
2. Yangi flow qo'shishdan oldin `user-flow-check` skillini ishlat.
3. Yangi modal kerak bo'lsa, ro'yxatni tekshir va mosini taklif qil.
4. Muhim arxitektura yoki xavfsizlik qarori yoki katta o'zgarish oldidan `senior-review` skillini ishlat.
5. Sessiya oxirida `obsidian-log` skillini ishlat (xulosa `00-Sessions\` ga).
6. Har bir muhim qaror sababi bilan (**Nima uchun**) yoziladi.

## 7. Ish tartibi (foydalanuvchi "boshla" degach)

Bosqichma-bosqich, har bosqich oxirida to'xtab foydalanuvchiga ko'rsat:
1. Django loyiha skeleti, ma'lumotlar modellari (DB), Django admin.
2. Ro'yxatdan o'tish, login, tasdiqlash va ruxsatlar.
3. Frontend asosi: dizayn tokenlari, yon panel, sarlavha, modal komponenti.
4. Sahifalar: Dasturchi → Loyiha menejeri → Boshqarma → Boshliq.
5. Word ko'rish, fayllar, bildirishnomalar, testlar.

## 8. Kod konvensiyalari

- UI matni kodga qattiq yozilmaydi: bitta joyda (`i18n`/matnlar fayli) turadi.
- Ranglar, o'lchamlar, sanalar — bitta joyda (tokenlar, `formatDate`).
- Holat o'tishlari bitta markaziy funksiyada (`transition` qoidalari), boshqa joyda takrorlanmaydi.
- Har bir ruxsat qoidasi va holat o'tishi uchun test yoziladi.
- Commit qilinmaydi, foydalanuvchi so'ramaguncha. Git hozircha yo'q.

## 9. Build va test buyruqlari

Backend (`backend/` papkasida, virtual muhit `backend/.venv`):
```
.venv/Scripts/python -m pip install -r requirements.txt   # bog'liqliklar
.venv/Scripts/python manage.py migrate                    # baza
.venv/Scripts/python manage.py createsuperuser            # admin (Boshliqni adminda yaratish uchun)
.venv/Scripts/python manage.py seed_demo                  # demo ma'lumotlar
.venv/Scripts/python manage.py runserver 127.0.0.1:8020   # http://127.0.0.1:8020/ (8020-port)
.venv/Scripts/python manage.py test                       # testlar (157 ta test)
.venv/Scripts/python manage.py runbot                     # Telegram bot (TELEGRAM_BOT_TOKEN muhit o'zgaruvchisi bilan)
.venv/Scripts/python manage.py makemigrations --check --dry-run   # sxema mosligi
```

Frontend (`frontend/` papkasida):
```
npm install               # bog'liqliklar
npx vite                  # dev-server: http://127.0.0.1:5173/ (8020 ga proksi qiladi)
npx tsc --noEmit -p .     # TypeScript tur tekshiruvi
npx vitest run            # testlar (44 ta, jsdom + @testing-library/react)
npx vite build            # prod build: dist/ (Django orqali beriladi)
```

## 10. Papka tuzilmasi

```
backend/   Django: config/ (settings, urls), apps/ (core, accounts, orders, projects, tasks, notifications)
frontend/  React + TS (4-bosqichda)
docs/      ARCHITECTURE.md, FLOWS_MODALS.md
```
Har bir app ichidagi qatlamlar (`models`, `workflow`, `services`, `permissions`, `serializers`, `api`, `admin`, `tests`) va bog'liqlik yo'nalishi — `docs/ARCHITECTURE.md` 3-bo'lim. Holat o'tishlari faqat `apps/*/workflow.py` jadvallarida.

## 11. Ma'lumot manbalari

- `README.md` — loyihaning to'liq tavsifi (yagona haqiqat manbai).
- `docs/FLOWS_MODALS.md` — flow va modal reestri.
- `docs/ARCHITECTURE.md` — arxitektura, ma'lumotlar modeli, API, bosqichlar.

## 12. Xavfsizlik

- Parollar Django parol hesh mexanizmi bilan saqlanadi.
- Fayl yuklashda tur va hajm tekshiriladi (.docx, rasm, PDF).
- Har bir API so'rovda rol va egalik serverda tekshiriladi (boshqarma faqat o'z buyurtmasini ko'radi, dasturchi faqat o'z vazifasini).
- Buyurtma yuborilgach boshqarma uni tahrirlay ham, o'chira ham olmaydi.

## 13. Foydalanuvchi qo'shimchalari

> Foydalanuvchi aytgan yangi qoidalar shu yerga sana bilan qo'shiladi.

- 2026-09-28: "Boshla" degunicha kod yozilmaydi.
- 2026-09-28: Flow'lar bitta bo'limda 3–4 ta, istisnoda 5 ta.
- 2026-09-28: Word fayllar loyihaning o'zida modal shaklida ochiladi.
- 2026-09-28: Vaultdagi `01-Projects\TeamFlow\` papkasidagi eski yozuvlarga e'tibor berilmaydi.
- 2026-09-28: UX 18–40 yoshdagilar uchun; ko'rgan zahoti tushunarli bo'lishi kerak (4-bo'lim).
- 2026-09-28: Backend Python/Django. Frontend React + TypeScript, Node faqat ishlab chiqishda kerak.
- 2026-09-28: "Boshla" deyildi — ish `docs/ARCHITECTURE.md` bo'yicha, 1-bosqichdan boshlandi.
- 2026-09-28: UI ni yaratishdan oldin Design System belgilanadi va barcha sahifalarda aynan shu Design System ishlatiladi (rang, spacing, radius, button, card uslublari bir xil saqlanadi). Har doim avvalgi holatga qaytarish imkoniyati (git tag/checkpoint) saqlanadi. Barcha ma'lumotlar to'liq databasedan olinadi.
- 2026-09-28: Xodimlar ro'yxati alohida "/xodimlar" sahifasiga ko'chirildi. Bosh panelda haftalik jami ishlar va asosiy ko'rsatkichlar yaqqol ko'rinib turadi.
- 2026-09-28: Vazifalar filtridan "Oy yarmi" olib tashlandi, uning o'rniga "Sanadan" va "Sanagacha" sana oralig'i (due_from / due_to) qo'yildi.
- 2026-09-28: Xodimlar sahifasida (/xodimlar) bo'sh xodimga (vazifasi yo'q / ish yuklamasi kam bo'lgan xodimga) to'g'ridan-to'g'ri vazifa berish va vazifani sub-tasklarga ajratib boshqa xodimlarga biriktirish imkoniyati.
- 2026-09-28: Yon panellar (drawer) butunlay olib tashlandi, foydalanuvchini chalg'itmasligi uchun faqat Modallardan foydalaniladi. Yangi sahifalar: Profil, Takliflar, Qilingan ishlar.
- 2026-09-28: Interfeys SaaS darajasida bo'lsin: vazifa tafsilotlari bitta katta modalda, mobilga mos yig'iladigan bo'limlarda ochilsin; xodimga vazifalarni shu modalda taqsimlash, ish jurnalini yuritish va loyiha faoliyatini ko'rish mumkin bo'lsin.
- 2026-09-30: Ildizdagi vaqtinchalik skriptlar `backend/scratch/`, `frontend/scratch/`, `docs/scratch/` ga ko'chirildi (ildizda faqat backend, frontend, docs va hujjatlar).
- 2026-09-30: UI 18–40 yoshdagilar uchun soddalashtirildi: telefonda filtrlar "Filtrlar" tugmasi ortida, jadvalda holat/muddat sarlavha ostida; bosh panel kartalari aniq nomlar bilan ("Faol", "Kechikib bajarilgan", "Tekshiruv kutilmoqda"); soxta ochiladigan belgilar olib tashlandi.
- 2026-09-30: Loyiha kompyuter yonganda (Windows'ga kirilganda) avtomatik ishga tushadi: `Startup\TeamFlow.vbs` → `backend/start_server.bat` → `http://127.0.0.1:8020/` (log: `backend/server.log`).
- 2026-09-30: Review kamchiliklari tuzatildi: chat qidiruvi, `requests` talablarda, Telegram faqat tranzaksiyadan keyin + timeout, `runbot` `notifications` ga ko'chirilib `requests` bilan qayta yozildi, sub-vazifa yaratish serializer orqali, Boshqarma menyusiga "Xabarlar", `Drawer` va eski fayllar o'chirildi, README/CLAUDE/GEMINI gitga qaytarildi.
- 2026-09-30: Vazifalar filtridan "Loyiha" maydoni olib tashlandi — bosh panelda ham, Vazifalar sahifasida ham ("Mening ishim" doskasidagi loyiha tanlovi qoladi).
- 2026-09-30: Frontend komponent testlari uchun `jsdom` va `@testing-library/react` qo'shildi (foydalanuvchi ruxsati bilan). Umumiy sozlama: `frontend/src/test/` (API va joriy foydalanuvchi soxtalashtiriladi).
- 2026-09-30: Loyiha GitHub'ga push qilindi (foydalanuvchi so'rovi bilan).
- 2026-09-30: "Barcha kamchiliklarni tuzat" bo'yicha qo'shimcha tuzatildi: Takliflar bo'limi (`/api/api/` 404 va sahifalash), xodim oynasi (hamma vazifalar chiqardi, "undefined" soni), profilda Telegram saqlanmasdi, chatda o'z xabarlari ko'rinmasdi va telefonga moslanmagan edi, aniqlanmagan CSS tokenlari, qattiq yozilgan matnlar `text.ts` ga ko'chirildi.
- 2026-09-30: Loyiha oynasi "Jamoa" bo'limida ro'yxatda faqat loyiha a'zolari ko'rinadi; boshqa dasturchilar qidiruv orqali topilib qo'shiladi. Har bir a'zo qatorida "Vazifa berish" tugmasi (shu xodimga alohida vazifa, loyiha va ijrochi oldindan tanlangan).
- 2026-09-30: Bosh panelga kirganda "Hafta boshidan — Faol" vazifalar jadvali darrov ochiq turadi (yopish mumkin).
- 2026-09-30: Loyiha va vazifalar kodlari (`TSK-12`, `PRJ-3`) ro'yxatlarda, doskada, modallarda va qidiruvda ko'rinadi; Ctrl K yoki Vazifalar qidiruvida kod yozilsa aynan o'sha yozuv darrov chiqadi. Kod qoidasi bitta joyda: `backend/apps/core/codes.py`.
- 2026-09-30: Ko'rib chiqishda topilgan kamchiliklar tuzatildi: `PRJ-n` qidiruvi, profildagi "Muddati o'tgan" soni, `Button` yuklanishda o'chmasligi, jamoadan chiqarilgan dasturchi vazifalari, Takliflar `workflow.py`/`services.py` ga ko'chirildi, `half` filtri olib tashlandi, `chat`/`suggestions` app fayllari, chatda rolsiz akkaunt chiqmaydi va oxirgi 200 xabar, Telegram username takrorlanmaydi.
- 2026-09-30: Loyiha yaratish oynasining 3-qadamida har bir tanlangan xodimga alohida vazifalar beriladi: nomi, boshlanish va tugash vaqti, vazifa fayllari (loyiha fayllari alohida). Loyiha, jamoa va vazifalar bitta so'rovda (`POST /api/projects/setup/`) bitta tranzaksiyada yaratiladi — biror vazifada xato bo'lsa, loyiha ham yaratilmaydi.
- 2026-09-30: Bildirishnomalar sahifasi qayta bezaldi: kun bo'yicha guruhlar (Bugun / Kecha / sana), tur bo'yicha rangli ikonka, o'qilmaganlar ajratib ko'rsatiladi, sarlavha ostida o'qilmaganlar soni; mavjud dizayn tokenlari bilan (boshqa sahifalardan ajralmaydi).
- 2026-09-30: Modal ochilganda manzilga `?task=4` kabi parametr qo'shilmaydi — manzil `/qilingan-ishlar` shaklida qoladi. Eski havolalar ishlaydi va darrov tozalanadi (`frontend/src/app/modals.tsx`).
- 2026-09-30: Dasturchi profilida (`/profil`) "Mening vazifalarim" jadvali — faqat o'ziga biriktirilgan vazifalar.
- 2026-09-30: Barcha profillar bir xil ko'rinishda: o'z profilim (`/profil`) va xodim oynasi umumiy `ProfileHeader` (avatar, ism, lavozim, 4 ko'rsatkich) va umumiy vazifalar jadvalidan (`TaskTable`) foydalanadi; "Faol" soni hamma joyda bir xil qoida bilan.
- 2026-09-30: Boshqarma uchun Bosh panel (`/`): salomlashish, "Yangi buyurtma", holat kartalari (bosilsa filtr) va o'z buyurtmalari jadvali. Menyuda "Bosh panel · Buyurtmalarim".
- 2026-09-30: Buyurtmalar (TZ) sahifasida "Hammasi" filtri birinchi o'rinda va standart tanlangan.
- 2026-09-30: Boshqarma bosh panelidagi "N ta buyurtmangiz rad etilgan…" eslatmasi olib tashlandi — bunday izoh kerak emas.
- 2026-09-30: Boshqarma bosh panelida "Yil boshidan / Oy boshidan / Hafta boshidan" kartalari — har birida Yuborilgan, Rad etilgan, Tasdiqlangan; ko'rinishi boshqa bosh panellar bilan bir xil (umumiy `PeriodCards`). Raqam bosilsa ro'yxat shu davr va toifa bo'yicha filtrlanadi (son va ro'yxat bitta qoidadan: `orders/filters.py`). Davr boshlanishi bitta joyda: `core/periods.py`.
- 2026-09-30: UI vizual uslubi yangilandi (faqat ko'rinish, tuzilma/flow/matnlar o'zgarmadi): tokenlarga shrift o'lchamlari, `--control` balandliklari (32/40/48, 8px setka), `--primary-solid` (tungi rejimda oq matn kontrasti), `--placeholder`; `--muted` AA kontrastga ko'tarildi; focus — `outline`; select inputlar bilan bir xil; tungi rejimda `color-scheme`; bosh panellardagi ikki marta qo'shilgan oraliqlar olib tashlandi; telefonda maydonlar 16px, menyu bandlari 44px. Qaytarish nuqtasi: git tag `ui-before-restyle`.
- 2026-09-30: Taqvimda kun bosilsa "Taqvim kuni" modali ochiladi (shu kungi vazifalar va shu kuni tugaydigan loyihalar); ro'yxatdagi vazifa/loyiha bosilsa modal o'rniga uning modali ochiladi, "Orqaga" kun ro'yxatiga qaytaradi. Taqvimda loyiha tugash sanalari ko'rinadi. Modallar soni 10 ta (`docs/FLOWS_MODALS.md`).
- 2026-09-30: Telegram bot ulandi (@taskbildirishnomasi_bot). Token va bot nomi `backend/.env` da (gitga tushmaydi, hech qachon commit qilinmaydi); bot `start_server.bat` bilan avtomatik ishga tushadi (log: `backend/bot.log`, tokensiz). Profildagi Telegram izohida botga havola.
- 2026-09-30: Dasturchi hisobida faqat o'z vazifalari: Vazifalar sahifasi va Ctrl K qidiruvida dasturchiga faqat o'ziga biriktirilgan vazifalar chiqadi (faqat sub-vazifasi biriktirilgan boshqa vazifa ro'yxatda chiqmaydi, lekin ochiladi). Qoida bitta joyda: `tasks/permissions.py` → `listed_tasks` (bosh panel ham shundan).
- 2026-09-30: Vazifa oynasida ijrochilar: bitta vazifaga bir nechta dasturchi ("O'zgartirish" — PM/Boshliq har qanday vazifaga, dasturchi faqat o'zi yaratgan vazifaga; o'zini olib tashlay olmaydi). Sub-vazifaga bir nechta dasturchi, mavjud sub-vazifaga ham qo'shish/olib tashlash (PM/Boshliq yoki vazifa ijrochisi). Ro'yxatda hamma faol dasturchilar (qidiruv), jamoada bo'lmasa loyiha jamoasiga avtomatik qo'shiladi. Baza: `SubTask.assignees` (M2M, migratsiya `0003`). Qaytarish nuqtasi: git tag `before-multi-assignee`.
- 2026-09-30: Profil rasmi: Profilda "Rasm yuklash / almashtirish / o'chirish" (JPG, PNG, WEBP, 5 MB gacha; server Pillow bilan tekshiradi, 1024px gacha kichraytirib JPEG qiladi, EXIF o'chadi). Rasm faqat tizimga kirganlarga beriladi: `GET /api/avatars/<id>/`. Hamma joyda avatar ustiga sichqoncha olib borilganda kichik profil kartochkasi chiqadi: rasm, ism familiya, rol (va boshqarma). Kartochka modal emas (`Avatar`, `shared/ui`).
- 2026-09-30: Profil sarlavhasidagi rasm (o'z profilim va xodim oynasi) bosilsa, Telegram kabi to'liq ekranda ochiladi: to'q fon, tepada ism va ✕; Esc, fon yoki "Orqaga" yopadi. Xodim oynasidan ochilsa uning o'rnini egallaydi (modal ustida modal yo'q). Yangi modal: "Rasm ko'rish" — modallar 11 ta. Rasm endi 1024px gacha saqlanadi (katta ko'rinishda tiniq).
- 2026-09-30: Loyihalar va Takliflar ro'yxatiga aniq tartib qo'shildi (`order_by("-created_at", "-id")`): `Count` annotatsiyasi bilan Meta.ordering qo'llanmasdi va sahifalashda yozuvlar takrorlanishi/tushib qolishi mumkin edi. Testlar: `ProjectListOrderTests`, `SuggestionListOrderTests`.
