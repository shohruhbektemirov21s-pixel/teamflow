# TeamFlow

Jamoa ishini boshqarish tizimi: boshqarmalar buyurtma (TZ) yuboradi, loyiha menejeri uni tasdiqlab loyihaga aylantiradi, dasturchilarga vazifa beradi va bajarilgan ishni tekshiradi. Boshliq hamma narsani kuzatadi va boshqaradi.

> **Holat (2026-09-28):** loyiha to'liq qurilgan, sinovdan o'tgan va ishchi holatda.
> Agentlar uchun qoidalar: `CLAUDE.md`, `GEMINI.md`. Flow va modal reestri: `docs/FLOWS_MODALS.md`. Arxitektura: `docs/ARCHITECTURE.md`.

## 1. Texnologiyalar

| Qatlam | Tanlov |
|---|---|
| Backend | Python + Django + Django REST Framework |
| Ma'lumotlar bazasi | Django standart bazasi (SQLite) |
| Admin panel | Django admin |
| Frontend | React + TypeScript |
| Word (.docx) ko'rish | Brauzerda, modal ichida (`docx-preview`) |
| Til | O'zbek (lotin), sana `dd.mm.yyyy` |

## 2. Rollar

| Rol | Qanday paydo bo'ladi | Nima qiladi |
|---|---|---|
| **Boshliq** | Faqat Django adminda yaratiladi | Hammani va hamma narsani ko'radi, izoh yozadi, hammaning ishini boshqaradi |
| **Loyiha menejeri (PM)** | Ro'yxatdan o'tadi, admin tasdiqlaydi | Buyurtmani tasdiqlaydi/rad etadi, loyiha yaratadi, dasturchi biriktiradi, vazifa beradi, ishni tekshiradi |
| **Dasturchi** | Ro'yxatdan o'tadi, admin tasdiqlaydi | O'ziga berilgan vazifani bajaradi va tekshiruvga yuboradi |
| **Boshqarma** | Ro'yxatdan o'tadi (boshqarma nomi bilan), admin tasdiqlaydi | Buyurtma (TZ) yuboradi |

### Ruxsatlar jadvali

| | Boshliq | PM | Dasturchi | Boshqarma |
|---|---|---|---|---|
| Ko'radi | Hamma narsa | Loyihalar, buyurtmalar, dasturchilar | Faqat o'z vazifalari va o'z loyihalari | Faqat o'z buyurtmalari |
| Buyurtma yuboradi | — | — | — | ✅ |
| Buyurtmani tasdiqlaydi/rad etadi | ✅ | ✅ | — | — |
| Loyiha yaratadi | ✅ | ✅ | ❌ | ❌ |
| Vazifa beradi | ✅ | ✅ | ❌ | ❌ |
| Vazifa holatini o'zgartiradi | ✅ | ✅ | Faqat o'zinikini (Jarayonda, Tekshiruvga yuborish) | — |
| Ishni tekshiradi (qabul/qaytarish) | ✅ | ✅ | — | — |
| Izoh yozadi | ✅ | ✅ | ✅ | ✅ |
| Foydalanuvchi yaratadi/tasdiqlaydi | Django admin orqali | — | — | — |

Barcha ruxsatlar serverda tekshiriladi.

## 3. Ro'yxatdan o'tish va kirish

Forma maydonlari:
1. Ism
2. Familiya
3. Mutaxassislik (tanlanadi)
4. Rol: Loyiha menejeri / Dasturchi / Boshqarma
5. Agar **Boshqarma** tanlansa, pastida **boshqarma nomi** maydoni chiqadi
6. Login
7. Parol

Qoidalar:
- Ro'yxatdan o'tgan foydalanuvchi **darrov kira olmaydi**. Django adminda faollashtirilgach kiradi.
- Kirishga urinsa: "Akkauntingiz hali tasdiqlanmagan".
- **Boshliq** ro'yxatdan o'tmaydi, Django adminda yaratiladi.

## 4. Buyurtma (TZ) jarayoni

```
Boshqarma buyurtma yuboradi (TZ v1)
   → PM ga bildirishnoma + "Buyurtmalar (TZ)" sahifasida ko'rinadi
   → PM buyurtmani ochadi (modal)
        ├─ RAD ETADI (sabab majburiy)
        │    → Boshqarma kamchiliklarni tuzatib yangi TZ (v2) yuboradi
        └─ TASDIQLAYDI: boshlanish sanasi + tugash sanasi + qisqa izoh
             → Buyurtma ichida "Loyiha yaratish" tugmasi chiqadi
             → Loyiha buyurtma ma'lumotlari bilan yaratiladi, sanalar PM kiritganlar
```

Buyurtma tarkibi (Boshqarma kiritadi): **nomi**, **qisqacha izoh**, **TZ fayli (.docx)**, **tugatish muddati** (qachongacha kerak), **muhimlik turi**.
Ko'rinadi: qaysi boshqarma va kim yuborgan.

Qoidalar:
- Boshqarma yuborgan buyurtmani **tahrirlay ham, o'chira ham olmaydi**.
- **Bitta buyurtma — bitta TZ.** PM tasdiqlamaguncha (yoki rad etmaguncha) boshqarma yangi versiya yubora olmaydi.
- Rad etilsa, boshqarma yangi TZ yuklaydi (v2, v3…). Versiyalar tarixi saqlanadi.
- Boshqarma so'ragan muddat va PM belgilagan sanalar **alohida** saqlanadi, PM ikkalasini ham ko'radi.
- Buyurtmadan loyiha yaratilgach, PM tahrirlashda **faqat sanalarni** o'zgartira oladi (nom, izoh, TZ o'zgarmaydi).
- Word (.docx) fayllar loyihaning o'zida **modal ichida** ochiladi.

## 5. Loyihalar

- Faqat **PM va Boshliq** loyiha yaratadi. **Dasturchi yarata olmaydi.**
- Loyiha: nom, izoh, boshlanish sanasi, tugash sanasi, fayllar, dasturchilar (bir nechta), darajasi.
- **Loyiha darajasi (4 ta):** Rejalashtirilgan → Boshlangan → Tuzatish kerak → Yakunlangan. PM qo'lda o'zgartiradi.
- Loyihaga bir nechta dasturchi biriktiriladi, har biriga bir nechta vazifa berish mumkin.
- Loyiha yaratish modali 3 qadamli: Asosiy → Jamoa → Vazifalar va fayllar. Buyurtmadan yaratilsa, 1-qadam oldindan to'ldirilgan.

## 6. Vazifalar

- PM/Boshliq loyiha ichida vazifa yaratadi: nom, izoh, muddat (boshlanish/tugash), muhimlik, fayl.
- **Ommaviy vazifalar**: PM ko'plab vazifalarni bitta ro'yxat matni (har qatorga bittadan) kiritish orqali bitta urinishda yarata oladi va ularga dasturchilarni biriktirishi mumkin.
- **Bitta vazifa bir nechta dasturchiga** biriktiriladi.
- **Sub-vazifalar** bor, ularga ham dasturchi biriktirish mumkin.
- **Ish jurnali:** ijrochi vazifa ichida qilgan ishi va sarflangan vaqtini qayd etadi; menejer uni tekshiruv bilan birga ko'radi.
- Vazifa berilganda dasturchida **Nazoratda** holatida paydo bo'ladi.

### Vazifa holatlari va hayot sikli

```
[Nazoratda] → dasturchi "Jarayonda" ga o'tkazadi
   → ish tugagach "Tekshiruvga yuboradi" (izoh: nima qilindi, fayl)
   → PM ga bildirishnoma, "Tekshiruv navbati" da ko'rinadi
        ├─ Qabul qilsa  → [Bajarildi]
        └─ Qaytarsa     → [Jarayonda] (izoh bilan)
```

Holatlar: **Nazoratda → Jarayonda → Tekshiruvda → Bajarildi**. "To'xtab qolgan" holati **yo'q** (foydalanuvchi qarori).
Muddati o'tgan vazifalar "Muddati o'tgan" deb hisoblanadi; muddatdan keyin bajarilgani "Muddati buzib bajarilgan" (aniqlanadi, 10-bo'limga qarang).

## 7. Sahifalar va yon panel (rolga qarab)

**Dasturchi:** Bosh panel · Vazifalar · **Mening ishim** · Taqvim | Xabarlar · Bildirishnomalar · Takliflar | Umumiy tarix
**Loyiha menejeri va Boshliq:** Bosh panel · Loyihalar · **Buyurtmalar (TZ)** · Vazifalar · Taqvim | Xodimlar · Xabarlar · Bildirishnomalar · **Tekshiruv navbati** · Takliflar | Umumiy tarix · Qilingan ishlar
**Boshqarma:** Buyurtmalarim | Xabarlar · Bildirishnomalar · Takliflar | Umumiy tarix

Chap menyu 3 bo'limga bo'lingan: *Asosiy ish*, *Muloqot*, *Kuzatuv*. Pastda foydalanuvchi kartasi (ism, rol; bosilsa — Profil) va "Chiqish". Yuqorida qidiruv (`Ctrl K`, `TSK-12` / `PRJ-3` kodlari bilan ham), tungi rejim, bildirishnomalar.
Kirilmagan foydalanuvchi uchun bosh sahifa (landing): qisqa tavsif, "Ro'yxatdan o'tish" va "Kirish".

### Bosh panel (PM)
- Tepada salomlashish va asosiy amallar: Xodimlar, (yangi buyurtma bo'lsa) Buyurtmalar, Yangi loyiha, **Yangi vazifa**. Xodimlar ro'yxati alohida `/xodimlar` sahifasida.
- Davr kartalari: Yil boshidan, Oy boshidan, Hafta boshidan (Faol, Muddati o'tgan, Bajarilgan).
- Qo'shimcha kartalar: Kechikib bajarilgan, Muddati o'tgan, Tekshiruv kutilmoqda.
- Kartani bossa, filtrli vazifalar jadvali ochiladi (qidiruv, muddat, sana oralig'i, holat, xodim). "Loyiha" filtri vazifalar jadvallarida yo'q (foydalanuvchi qarori). Telefonda qidiruvdan boshqa filtrlar "Filtrlar" tugmasi ortida.

### Bosh panel (Dasturchi)
Xuddi shu tuzilma, sonlar faqat shu dasturchining o'z vazifalari bo'yicha.

### Mening ishim (Dasturchi)
- "+ Yangi vazifa" tugmasi, filtrlar (loyiha, muddat: Bugun / Shu hafta / Hammasi).
- Doska ustunlari — holatlar: **Nazoratda | Jarayonda | Tekshiruvda | Bajarildi**.
- Vazifani **sichqoncha bilan sudrab** ustunlar orasida o'tkazish mumkin.
- **Tekshiruvda** ustuniga tashlanganda "Nima qildingiz?" modali ochiladi (izoh, fayl).
- **Bajarildi** ustuniga dasturchi tashlay olmaydi, uni faqat PM tasdiqlaydi.
- Sudrab bo'lmaydigan holat uchun kartada "⋯" menyu (klaviatura bilan).
- Xato bo'lsa o'zgarish orqaga qaytariladi, "Bekor qilish" xabari chiqadi.

### Boshliq
- `/xodimlar` sahifasida barcha xodimlarni va ularning nima qilayotganini ko'radi.
- Barcha loyihalar, buyurtmalar, vazifalarni ko'radi va boshqaradi (PM huquqlari + hammasi).
- Loyiha, vazifa va buyurtmaga izoh yozadi.

### Xodimlar (/xodimlar)
- Barcha jamoa a'zolari (dasturchilar, menejerlar) ro'yxati, bandligi, faol/kechikkan vazifalari.
- Bo'sh (vazifasi yo'q) xodimga to'g'ridan-to'g'ri vazifa berish tugmasi.
- Vazifa doirasida sub-tasklar ochilib, ularga boshqa xodimlar biriktiriladi.
- Xodimni bossa, uning oynasi (modal) ochiladi: statistika, joriy ishlari, vazifa berish.

### Telegram bildirishnomalari
- Ro'yxatdan o'tishda Telegram username (`@username`) yoziladi.
- Foydalanuvchi botga `/start` yozadi → akkaunti topilsa (faol, username bitta akkauntda), chat bog'lanadi.
- Shundan keyin tizimdagi har bir bildirishnoma Telegram'ga ham yuboriladi (amal muvaffaqiyatli saqlangandan keyin).
- Token: `TELEGRAM_BOT_TOKEN` muhit o'zgaruvchisi. Bo'sh bo'lsa Telegram o'chiq, tizim odatdagidek ishlaydi.

### Kodlar
Vazifa va loyihalarning qisqa kodi bor: `TSK-12`, `PRJ-3`. Qidiruvda kod bilan topish mumkin.

## 8. Modallar (amalda: 9 ta)

Ko'rish, yaratish, tahrirlash — hammasi modalda. Batafsil: `docs/FLOWS_MODALS.md`.
1. Buyurtma yaratish · 2. Buyurtma ko'rish · 3. Loyiha yaratish · 4. Loyiha ko'rish/tahrirlash · 5. Vazifa yaratish/tahrirlash · 6. Vazifa ko'rish (tekshiruv shu yerda) · 7. Xodim profili · 8. Taklif yaratish · 9. Taklif ko'rish.
Word ko'rish alohida modal emas — joriy modal ichini almashtiradi ("← Orqaga").

Modal qoidalari: sarlavha + ✕ tepada, tugmalar paneli pastda doim ko'rinadi, modal ustida modal ochilmaydi, manzilga bog'lanadi (`/buyurtmalar/12`), `Esc` yopadi, telefonda butun ekran.

## 9. Flow cheklovi

Bitta bo'limda **3–4 ta flow**, istisnoda **5 ta**. Amalda: 12 ta flow (auth 1, orders 3, projects 1, tasks 3, profil 1, takliflar 1, qilingan ishlar 1, bildirishnomalar 1). Batafsil: `docs/FLOWS_MODALS.md`.

## 10. Qabul qilingan qarorlar va ochiq savollar

**Qaror sifatida qabul qilinganlar:**
- **Muhimlik turi:** boshqarma buyurtma yuborganda tanlaydi, PM tasdiqlaganda o'zgartira oladi.
- **Mas'ul PM:** buyurtmani tasdiqlagan PM avtomatik mas'ul bo'ladi. Dasturchilar loyiha yaratilganda biriktiriladi.
- **Sub-vazifalar:** kichik qadamlar, har biriga dasturchi biriktirish mumkin.
- **Xabarlar (Chat):** Foydalanuvchilar orasida shaxsiy yozishma qilish funksiyasi qo'shildi.
- **Ommaviy vazifalar:** Bir qancha vazifalarni matn shaklida birdan yaratish.
- **Mutaxassisliklar ro'yxati:** Backend, Frontend, Mobil, UI/UX Dizayner, QA (Tester), Loyiha Menejeri (PM).
- **Boshqarma rolining yon paneli:** Buyurtmalar, Xabarlar, Bildirishnomalar, Takliflar, Umumiy tarix.
- **Autentifikatsiya usuli:** Cookie / Session asosida (Django REST Framework standard cookie auth).
- **Fayl turlari va hajm:** .docx, .pdf, .png, .jpg. Hajm chegarasi: 20 MB.
- **Takliflar bo'limi:** Tizimni yaxshilash bo'yicha g'oyalar (Kutmoqda, Qabul qilingan, Rad etilgan holatlari bilan).

## 11. Ishga tushirish yo'riqnomasi va Demo loginlar

### Demo foydalanuvchilar (parol: `Demo-parol-2026`)

| Login | Ism | Rol | Mutaxassislik / Boshqarma |
|---|---|---|---|
| `boshliq` | Akmal Karimov | Boshliq | Boshqaruv |
| `pm` | Sardor Rustamov | Loyiha menejeri | Loyiha menejeri |
| `jasur` | Jasur Alimov | Dasturchi | Backend dasturchi |
| `malika` | Malika Karimova | Dasturchi | Frontend dasturchi |
| `bobur` | Bobur Rahimov | Dasturchi | Mobil dasturchi |
| `it_boshqarma` | Shoxrux Hamidov | Boshqarma | Axborot texnologiyalari boshqarmasi |
| `admin` | Administrator | Superuser | Django admin (parol: `Admin-parol-2026`) |

### Ishga tushirish buyruqlari

**1. Backend (Django REST Framework):**
```bash
cd backend
.venv\Scripts\python manage.py migrate
.venv\Scripts\python manage.py seed_demo                  # demo ma'lumotlarni yuklash
.venv\Scripts\python manage.py runserver 127.0.0.1:8020   # http://127.0.0.1:8020/
.venv\Scripts\python manage.py test                       # testlarni yurgizish (101 ta)
set TELEGRAM_BOT_TOKEN=...  &  .venv\Scripts\python manage.py runbot   # Telegram bot (ixtiyoriy)
```

**2. Frontend — Ishlab chiqish (Vite dev server):**
```bash
cd frontend
npm install
npx vite                                                  # http://127.0.0.1:5173/
npx tsc --noEmit -p .                                     # tur tekshiruvi
npx vitest run                                            # testlar (14 ta: jsdom + Testing Library)
```

**3. Ishlab chiqarish (Production build — Node talab etilmaydi):**
```bash
cd frontend
npx vite build                                            # frontend/dist ga build qiladi
```
Frontend Django orqali to'g'ridan-to'g'ri `http://127.0.0.1:8020/` manzilida ochiladi.

**4. Avtomatik ishga tushirish (Windows):** kompyuterga kirilganda `Startup` papkasidagi `TeamFlow.vbs` yashirin oynada `backend/start_server.bat` ni ishga tushiradi → `http://127.0.0.1:8020/`. Log: `backend/server.log`. O'chirish: `shell:startup` papkasidan `TeamFlow.vbs` ni o'chiring. Frontend o'zgarsa, `npx vite build` qilish kerak. Backend kodi o'zgarsa, server qayta ishga tushiriladi (avtoishga tushirish `--noreload` bilan ishlaydi): `shell:startup\TeamFlow.vbs` ni qayta bosing yoki kompyuterni qayta yoqing.

## 12. UX maqsadi

Auditoriya **18–40 yosh**. Interfeys ko'rgan zahoti tushunarli bo'lishi kerak: oddiy o'zbekcha so'zlar, har ekranda bitta asosiy amal, ikonka doim matn bilan, tanish naqshlar (doska, sudrab o'tkazish, qidiruv), bo'sh holatda keyingi qadam tushuntiriladi, xatoda nima qilish kerakligi yoziladi. Batafsil qoidalar: `CLAUDE.md` 4-bo'lim.

## 13. Ish qoidalari

- "Boshla" degunicha kod yozilmaydi.
- Faqat foydalanuvchi aytgan narsa qilinadi, o'zboshimchalik yo'q.
- Yangi talablar `CLAUDE.md`/`GEMINI.md` 13-bo'limiga va shu `README.md` ga qo'shiladi.
- Dizayn oldingi loyiha skrinshotlaridan nusxa ko'chirilmaydi.
- Vazifa tafsilotlari bitta katta, mobilga mos modalda bo'limlarga ajratiladi; ommaviy taqsimlash va ish jurnali ham shu oqimda ishlaydi.
