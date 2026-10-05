# TeamFlow

Jamoa ishini boshqarish tizimi. Boshqarmalar buyurtma (TZ) yuboradi, loyiha menejeri uni tasdiqlab loyihaga aylantiradi, dasturchilarga topshiriq beradi va bajarilgan ishni tekshiradi. Boshliq hamma narsani kuzatadi va boshqaradi.

> **Holat (2026-10-05):** arxitektura ko'rigi, regressiya tuzatishlari, xizmat safari va GitHub'dagi loyiha tasdiqlash funksiyasi birga tekshirildi: 194 backend testi, 63 frontend testi, TypeScript tur tekshiruvi va frontend build o'tdi. Ishchi muhitdagi joylashtirish alohida tekshirilmagan.
> Bu fayl — loyihaning **yagona haqiqat manbai**. Agentlar uchun qoidalar: `CLAUDE.md`, `GEMINI.md`. Flow va modal reestri: `docs/FLOWS_MODALS.md`. Arxitektura, ma'lumotlar modeli va API: `docs/ARCHITECTURE.md`.

## Mundarija

1. [Texnologiyalar](#1-texnologiyalar)
2. [Rollar va ruxsatlar](#2-rollar-va-ruxsatlar)
3. [Ro'yxatdan o'tish va kirish](#3-royxatdan-otish-va-kirish)
4. [Buyurtma (TZ) jarayoni](#4-buyurtma-tz-jarayoni)
5. [Loyihalar](#5-loyihalar)
6. [Topshiriqlar](#6-topshiriqlar)
7. [Menyu va sahifalar](#7-menyu-va-sahifalar)
8. [Telegram bildirishnomalari](#8-telegram-bildirishnomalari)
9. [Modallar](#9-modallar-amalda-13-ta)
10. [Flow'lar](#10-flowlar-amalda-13-ta)
11. [Qarorlar va ochiq savollar](#11-qabul-qilingan-qarorlar-va-ochiq-savollar)
12. [Xavfsizlik](#12-xavfsizlik)
13. [Ishga tushirish va demo loginlar](#13-ishga-tushirish-va-demo-loginlar)
14. [Papka tuzilmasi](#14-papka-tuzilmasi)
15. [UX maqsadi](#15-ux-maqsadi)
16. [Ish qoidalari](#16-ish-qoidalari)

---

## 1. Texnologiyalar

| Qatlam | Tanlov |
|---|---|
| Backend | Python + Django + Django REST Framework |
| Ma'lumotlar bazasi | Django standart bazasi (SQLite) |
| Admin panel | Django admin (alohida admin panel yozilmaydi) |
| Frontend | React + TypeScript (Vite). Node faqat ishlab chiqishda kerak |
| Word (.docx) ko'rish | Brauzerda, modal ichida (`docx-preview`) |
| Autentifikatsiya | Cookie / Session (DRF standart) + CSRF |
| Bildirishnomalar | Tizim ichida + Telegram bot |
| Til | O'zbek (lotin), sana `dd.mm.yyyy` |

Barcha ma'lumotlar bazadan olinadi. Butun interfeys bitta Design System (ranglar, oraliqlar, radius, tugma va karta uslubi) bilan quriladi, tokenlar bitta joyda: `frontend/src/shared/styles.css`.

## 2. Rollar va ruxsatlar

| Rol | Qanday paydo bo'ladi | Nima qiladi |
|---|---|---|
| **Boshliq** | Faqat Django adminda yaratiladi | Hammani va hamma narsani ko'radi, izoh yozadi, hammaning ishini boshqaradi, takliflar bo'yicha qaror chiqaradi |
| **Loyiha menejeri (PM)** | Ro'yxatdan o'tadi, admin tasdiqlaydi | Buyurtmani tasdiqlaydi yoki rad etadi, loyiha yaratadi, dasturchi biriktiradi, topshiriq beradi, ishni tekshiradi |
| **Dasturchi** | Ro'yxatdan o'tadi, admin tasdiqlaydi | O'ziga berilgan topshiriqni bajaradi va tekshiruvga yuboradi |
| **Boshqarma** | Ro'yxatdan o'tadi (boshqarma nomi bilan), admin tasdiqlaydi | Buyurtma (TZ) yuboradi |

### Ruxsatlar jadvali

| | Boshliq | PM | Dasturchi | Boshqarma |
|---|---|---|---|---|
| Ko'radi | Hamma narsa | Loyihalar, buyurtmalar, topshiriqlar, xodimlar | Faqat o'z topshiriqlari va o'z loyihalari | Faqat o'z buyurtmalari |
| Buyurtma yuboradi | — | — | — | ✅ |
| Buyurtmani tasdiqlaydi / rad etadi | ✅ | ✅ | — | — |
| Loyiha yaratadi | ✅ | ✅ | ❌ | ❌ |
| Topshiriq beradi | ✅ | ✅ | O'zi yaratgan topshiriqqa boshqa dasturchini qo'shadi | ❌ |
| Xizmat safarini belgilaydi/tugatadi | ✅ | ❌ | ❌ | ❌ |
| Topshiriq holatini o'zgartiradi | ✅ | ✅ | Faqat o'zinikini (Jarayonda, Tekshiruvga yuborish) | — |
| Ishni tekshiradi (qabul / qaytarish) | ✅ | ✅ | — | — |
| Izoh yozadi (ko'ra oladigan joyiga) | ✅ | ✅ | ✅ | ✅ |
| Taklif bo'yicha qaror | ✅ | — | — | — |
| Foydalanuvchi yaratadi / tasdiqlaydi | Django admin orqali | — | — | — |

Barcha ruxsatlar **serverda** tekshiriladi, frontendda tugmani yashirish yetarli hisoblanmaydi.

## 3. Ro'yxatdan o'tish va kirish

Forma maydonlari:
1. Ism
2. Familiya
3. Mutaxassislik (ro'yxatdan tanlanadi)
4. Rol: Loyiha menejeri / Dasturchi / Boshqarma
5. **Boshqarma** tanlansa, pastida **boshqarma nomi** maydoni chiqadi
6. Telegram username (`@username`) — bildirishnomalar uchun (8-bo'lim)
7. Login
8. Parol

Qoidalar:
- Ro'yxatdan o'tgan foydalanuvchi **darrov kira olmaydi**. Django adminda faollashtirilgach kiradi.
- Kirishga urinsa: "Akkauntingiz hali tasdiqlanmagan".
- **Boshliq** ro'yxatdan o'tmaydi, Django adminda yaratiladi.
- Kirilmagan foydalanuvchi uchun bosh sahifa (landing): qisqa tavsif, "Ro'yxatdan o'tish" va "Kirish".

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

Buyurtma holatlari: **Yuborilgan → Tasdiqlangan → Loyiha yaratilgan**, yoki **Rad etilgan → (yangi TZ) → Yuborilgan**. O'tishlar bitta jadvalda: `backend/apps/orders/workflow.py`.

Buyurtma tarkibi (Boshqarma kiritadi): **nomi**, **qisqacha izoh**, **TZ fayli (.docx)**, **tugatish muddati** (qachongacha kerak), **muhimlik turi** (Past, O'rtacha, Yuqori, Shoshilinch).
Buyurtmada qaysi boshqarma va kim yuborgani ko'rinadi.

Qoidalar:
- Boshqarma yuborgan buyurtmani **tahrirlay ham, o'chira ham olmaydi**.
- **Bitta buyurtma — bitta TZ.** PM tasdiqlamaguncha (yoki rad etmaguncha) boshqarma yangi versiya yubora olmaydi.
- Rad etilsa, boshqarma yangi TZ yuklaydi (v2, v3…). Versiyalar tarixi saqlanadi.
- Boshqarma so'ragan muddat va PM belgilagan sanalar **alohida** saqlanadi, PM ikkalasini ham ko'radi.
- Muhimlik turini boshqarma tanlaydi, PM tasdiqlaganda o'zgartira oladi.
- Buyurtmani tasdiqlagan PM avtomatik mas'ul bo'ladi.
- Buyurtmadan loyiha yaratilgach, PM/Boshliq loyiha oynasida nomi, izohi va sanalarini tahrirlashi mumkin — o'zgarish bog'liq buyurtmaga ham ko'chadi (ikkalasi bitta TZ ma'lumotini ko'rsatadi). TZ fayli o'zgarmaydi.
- Word (.docx) fayllar tizimning o'zida **modal ichida** ochiladi.

## 5. Loyihalar

- Faqat **PM va Boshliq** loyiha yaratadi. **Dasturchi yarata olmaydi.**
- Loyiha: **loyiha raqami** (qo'lda kiritiladi, majburiy, erkin matn/kod — masalan `PRJ-12`, takrorlanmaydi: band bo'lsa xatolik chiqadi), nom, izoh, boshlanish sanasi, tugash sanasi, fayllar, dasturchilar (bir nechta), darajasi.
- **Loyiha darajasi (5 ta):** Rejalashtirilgan → Boshlangan → Tuzatish kerak → Tasdiqlash kutilmoqda → Yakunlangan. PM/Boshliq qo'lda o'zgartiradi.
- **Yakunlashni tasdiqlash:** PM/Boshliq "Yakunlangan"ni tanlaganda, avval **loyihadagi barcha faol dasturchilarga** bildirishnoma boradi ("Loyiha yakunlanishi kerak, tasdiqlaysizmi?" — bildirishnoma ichidagi tugma bilan Ha/Yo'q). **Hammasi tasdiqlagandan keyingina** keyingi bosqich ishga tushadi: buyurtmasiz (PM o'zi yaratgan) loyiha "Yakunlangan"ga to'g'ridan-to'g'ri o'tadi; buyurtmadan yaratilgan loyiha avval **"Tasdiqlash kutilmoqda"**ga o'tadi va buyurtmani yuborgan boshqarmaga bildirishnoma boradi — faqat o'sha boshqarma (Buyurtma oynasidan) **Tasdiqlaydi** (loyiha "Yakunlangan" bo'ladi) yoki **kamchilik sababi bilan rad etadi** ("Tuzatish kerak"ga qaytadi, PM sababni ko'rib tuzatib yana so'raydi). Agar birortasi dasturchi sababli rad etsa, loyiha yakunlanmaydi, hozirgi holatida davom etadi va PM/Boshliq sababni ko'radi; qayta so'ralganda hammadan yangidan so'raladi. Loyihada faol dasturchi bo'lmasa, dasturchi so'rovi o'tkazib yuboriladi.
- Loyihaga bir nechta dasturchi biriktiriladi, har biriga bir nechta topshiriq berish mumkin.

**Loyiha yaratish oynasi (3 qadam):** Asosiy → Jamoa → Topshiriqlar va fayllar. Buyurtmadan yaratilsa, 1-qadam oldindan to'ldirilgan.
- 1-qadamda (**Asosiy**) **loyiha raqami** maydoni bor — foydalanuvchi qo'lda kiritadi, bo'sh qoldirib bo'lmaydi, boshqa loyihada xuddi shu raqam bo'lsa xatolik chiqib saqlanmaydi.
- 3-qadamda **loyiha fayllari** va **har bir xodimga alohida topshiriqlar** beriladi. Har bir tanlangan xodim uchun alohida blok va "Topshiriq qo'shish" tugmasi bor: topshiriq nomi, **boshlanish** va **tugash vaqti**, **topshiriq fayllari**. Tugash vaqti boshlanishdan oldin bo'lsa, yaratib bo'lmaydi.
- Loyiha, jamoa va topshiriqlar bitta so'rovda (`POST /api/projects/setup/`) bitta tranzaksiyada yaratiladi. Biror topshiriqda xato bo'lsa, hech narsa saqlanmaydi (chala loyiha qolmaydi).

**Loyiha oynasi — Jamoa bo'limi:**
- Ro'yxatda faqat shu loyiha a'zolari ko'rinadi. Yangi dasturchi qidiruv maydoni orqali topilib qo'shiladi, keyin "Jamoani saqlash" bosiladi.
- Har bir a'zo qatorida **"Topshiriq berish"** tugmasi bor: shu xodimga alohida topshiriq ochiladi, loyiha va ijrochi oldindan tanlangan bo'ladi. Jamoa saqlanmaguncha bu tugma o'chiq turadi.
- Dasturchi jamoadan chiqarilsa, shu loyihaning tugallanmagan topshiriqlari va sub-vazifalaridan ham olib tashlanadi (bajarilganlari tarix sifatida qoladi). Agar u faol topshirig'ining yagona ijrochisi bo'lsa, avval topshiriqni boshqa xodimga berish so'raladi.

## 6. Topshiriqlar

- PM/Boshliq loyiha ichida topshiriq yaratadi: nom, izoh, muddat (boshlanish/tugash), muhimlik, fayl.
- **Ommaviy topshiriqlar:** PM bitta ro'yxat matni (har qatorga bittadan) orqali ko'p topshiriqni birdaniga yaratadi va har biriga ijrochi biriktira oladi.
- **Bitta topshiriq bir nechta dasturchiga** biriktiriladi. Topshiriq oynasida "Ijrochilar → O'zgartirish": PM va Boshliq har qanday topshiriqqa, dasturchi faqat **o'zi yaratgan** topshiriqqa boshqa dasturchini qo'shadi (o'zini olib tashlay olmaydi). Bajarilgan topshiriq o'zgartirilmaydi.
- **Sub-vazifalar:** kichik qadamlar, har biriga **bir nechta dasturchi** biriktiriladi. Mavjud sub-vazifaga ham keyin qo'shish yoki olib tashlash mumkin (PM, Boshliq yoki topshiriq ijrochisi). Ijrochisiz sub-vazifa "Hamma" deb ko'rinadi (topshiriqning barcha ijrochilari).
- Topshiriq oynasida dasturchi **qidiruv** bilan tanlanadi, ro'yxatda hamma faol dasturchilar chiqadi. Loyiha jamoasida bo'lmagan dasturchi tanlansa, u **loyiha jamoasiga avtomatik qo'shiladi**. Topshiriq yaratish/tahrirlash formasida esa faqat loyiha jamoasi ko'rinadi.
- **Ish jurnali:** ijrochi topshiriq ichida qilgan ishi va sarflangan vaqtini qayd etadi, menejer uni tekshiruv bilan birga ko'radi.
- **Topshiriqni o'chirish:** PM/Boshliq topshiriqni arxivlaydi. U ish ro'yxatlari va hisoblagichlardan chiqadi, lekin topshirishlar, ish jurnali, izohlar va fayllar tarix uchun saqlanadi. Arxivdagi topshiriq faqat ko'riladi.
- Topshiriq tafsilotlari **bitta katta modalda**, telefonda yig'iladigan bo'limlarga ajratilgan: ma'lumot, sub-vazifalar, tekshiruv, ish jurnali, izohlar, fayllar.
- Topshiriq berilganda dasturchida **Nazoratda** holatida paydo bo'ladi.

### Topshiriq holatlari

```
[Nazoratda] → "Jarayonda" ga o'tkaziladi
   → ish tugagach "Tekshiruvga yuborish" (izoh: nima qilindi, fayl)
   → PM ga bildirishnoma, "Tekshiruv navbati" da ko'rinadi
        ├─ Qabul qilsa  → [Bajarildi]
        └─ Qaytarsa     → [Jarayonda] (izoh bilan)
```

- Holatlar: **Nazoratda → Jarayonda → Tekshiruvda → Bajarildi**. "To'xtab qolgan" holati **yo'q** (foydalanuvchi qarori).
- **Bajarildi** ga faqat tekshiruvda qabul qilinganda o'tiladi, dasturchi o'zi o'tkaza olmaydi.
- **Menejer (PM/Boshliq) ijrochi bo'lmay "Tekshiruvga yuborish" bossa — ijrochi(lar) ruxsati kerak** (foydalanuvchi talabi, 2026-10-05): topshiriq darhol Tekshiruvdaga o'tmaydi, topshiriqning barcha faol ijrochilariga bildirishnoma boradi ("Tekshiruvga yuborishga roziman?", "Ha, tayyor"/"Yo'q" tugmasi bilan — mavjud Bildirishnomalar modali ichida, yangi modal yo'q). Barcha ijrochi "Ha" desa, shu zahoti haqiqiy Tekshiruvga o'tadi (menejer qayta bosishi shart emas). Birortasi sabab bilan rad etsa, so'rov bekor bo'ladi, topshiriq Jarayonda qoladi, menejer sababni ko'radi; qayta so'raganda hammadan yangidan so'raladi. Topshiriqning o'z ijrochisi hech qachon tasdiq so'ralmasdan to'g'ridan-to'g'ri yuboradi (bu qoida faqat ijrochi bo'lmagan menejerga tegishli).
- Muddati o'tgan faol topshiriq — **"Muddati o'tgan"**, muddatdan keyin bajarilgani — **"Kechikib bajarilgan"**.
- O'tishlar bitta jadvalda: `backend/apps/tasks/workflow.py`.

### Kodlar

**Topshiriq** yaratilganda tasodifiy, takrorlanmaydigan **9 xonali kod** oladi (masalan `483920157`) — ketma-ket emas, umumiy sonni ko'rsatmaydi. Bazada saqlanadi (`Task.code`), ro'yxatlarda, doskada, tekshiruv navbatida va modal sarlavhasida ko'rinadi. Qoida bitta joyda: `backend/apps/core/codes.py`.

**Loyiha** endi avtomatik kod olmaydi — o'rniga PM/Boshliq loyiha yaratishda (1-qadam) **loyiha raqamini qo'lda kiritadi** (majburiy, erkin matn/kod, masalan `PRJ-12`). Boshqa loyihada xuddi shu raqam bo'lsa, saqlashda xatolik chiqadi (takrorlanmaydi). `Project.code` shu qo'lda kiritilgan raqamni saqlaydi; ro'yxatlarda, loyiha oynasi sarlavhasida va qidiruvda shu raqam ko'rinadi.
- `Ctrl K` qidiruvida topshiriqning 9 xonali kodi yoki loyihaning qo'lda kiritilgan raqami yozilsa, aynan o'sha topshiriq/loyiha darrov chiqadi (ko'rish huquqi bo'lsa).
- Topshiriqlar jadvali qidiruvida topshiriq kodi — shu topshiriq, loyiha raqami — shu loyihaning topshiriqlari.

## 7. Menyu va sahifalar

### Chap menyu (rolga qarab)

Menyu guruhlarga bo'lingan: *Asosiy ish* | *Muloqot* | *Kuzatuv* (Kuzatuv faqat PM va Boshliqda bor).

| Rol | Asosiy ish | Muloqot | Kuzatuv |
|---|---|---|---|
| **Dasturchi** | Bosh panel · Topshiriqlar · Mening ishim · Taqvim | Xabarlar · Takliflar | — |
| **PM va Boshliq** | Bosh panel · Loyihalar · Buyurtmalar (TZ) · Topshiriqlar · Taqvim | Xodimlar · Xabarlar · Tekshiruv navbati · Takliflar | Qilingan ishlar |
| **Boshqarma** | Bosh panel · Buyurtmalarim | Xabarlar · Takliflar | — |

- Menyu pastida foydalanuvchi kartasi (ism, rol; bosilsa Profil ochiladi) va "Chiqish".
- Yuqorida: qidiruv (`Ctrl K`, kodlar bilan ham), tungi/kunduzgi rejim, bildirishnomalar (qo'ng'iroq ikonkasi — o'z soni bilan; bosilsa modal ochiladi, chap menyuda alohida band yo'q, barcha rolda shu yerdan ochiladi).
- Yon panel (drawer) **ishlatilmaydi**: ko'rish, yaratish, tahrirlash — faqat modalda.
- Manzillar: `/`, `/vazifalar`, `/mening-ishim`, `/taqvim`, `/loyihalar`, `/buyurtmalar`, `/xodimlar`, `/tekshiruv`, `/xabarlar`, `/takliflar`, `/qilingan-ishlar`, `/profil`. Rolga tegishli bo'lmagan sahifa ochilmaydi. (Bildirishnomalar alohida sahifa emas — qo'ng'iroq ikonkasi modal ochadi, 9-bo'lim.)

### Bosh panel — PM va Boshliq
- Tepada salomlashish va asosiy amallar: Xodimlar, (yangi buyurtma bo'lsa) Buyurtmalar, Yangi loyiha, **Yangi topshiriq**.
- Davr kartalari: **Yil boshidan, Oy boshidan, Hafta boshidan** — har birida Faol, Muddati o'tgan, Bajarilgan.
- Qo'shimcha kartalar aniq nomlar bilan: **Kechikib bajarilgan**, **Muddati o'tgan**, **Tekshiruv kutilmoqda**.
- Kirganda **"Hafta boshidan — Faol"** topshiriqlar jadvali darrov ochiq turadi (boshqa kartani bossa almashadi, "Yopish" bilan yopiladi).
- Kartani bossa, filtrli topshiriqlar jadvali ochiladi: qidiruv, muddat, sana oralig'i (**Sanadan** / **Sanagacha**), holat, xodim. "Loyiha" filtri topshiriqlar jadvallarida yo'q (foydalanuvchi qarori). Telefonda qidiruvdan boshqa filtrlar "Filtrlar" tugmasi ortida.

### Bosh panel — Dasturchi
- Xuddi shu tuzilma, sonlar faqat shu dasturchining o'z topshiriqlari bo'yicha.

### Bosh panel — Boshqarma
- Salomlashish, boshqarma nomi, "Yangi buyurtma" va "Buyurtmalarim" tugmalari.
- Davr kartalari (boshqa bosh panellar bilan bir xil ko'rinish, umumiy `PeriodCards`): **Yil boshidan, Oy boshidan, Hafta boshidan** — har birida **Yuborilgan** (shu davrda yuborilgan), **Rad etilgan** va **Tasdiqlangan** (shu davrda qaror chiqqan, loyiha bo'lganlari bilan). Raqam bosilsa pastdagi ro'yxat shu buyurtmalar bilan filtrlanadi (son va ro'yxat bitta qoidadan: `orders/filters.py`, davr boshlanishi: `core/periods.py`).
- Holat kartalari: Yuborilgan, Rad etilgan, Tasdiqlangan (loyiha bo'lganlari bilan). Bosilsa pastdagi ro'yxat filtrlanadi.
- Pastda faqat o'z buyurtmalari jadvali. Qo'shimcha eslatma matnlari chiqmaydi (foydalanuvchi qarori).

### Topshiriqlar (`/vazifalar`)
- Topshiriqlar jadvali: qidiruv (kodlar bilan ham), muddat, sana oralig'i, holat, xodim filtrlari. Telefonda filtrlar "Filtrlar" tugmasi ortida, jadvalda holat va muddat sarlavha ostida ko'rinadi.
- Dasturchiga **faqat o'ziga biriktirilgan** topshiriqlar chiqadi (Ctrl K qidiruvida ham). Faqat sub-vazifasi biriktirilgan boshqa topshiriq ro'yxatda chiqmaydi, lekin ochib sub-vazifani bajarish mumkin. Qoida bitta joyda: `tasks/permissions.py` → `listed_tasks`.

### Mening ishim (`/mening-ishim`, Dasturchi)
- "+ Yangi topshiriq" tugmasi, filtrlar: loyiha, muddat (Bugun / Shu hafta / Hammasi).
- Doska ustunlari — holatlar: **Nazoratda | Jarayonda | Tekshiruvda | Bajarildi**.
- Topshiriqni **sichqoncha bilan sudrab** ustunlar orasida o'tkazish mumkin.
- **Tekshiruvda** ustuniga tashlanganda "Nima qildingiz?" oynasi ochiladi (izoh, fayl).
- **Bajarildi** ustuniga dasturchi tashlay olmaydi, uni faqat PM tasdiqlaydi.
- Sudrab bo'lmaydigan holat uchun kartada "⋯" menyu (klaviatura bilan).
- Xato bo'lsa o'zgarish orqaga qaytariladi, "Bekor qilish" xabari chiqadi.

### Taqvim (`/taqvim`, Dasturchi, PM, Boshliq)
- Oylik ko'rinish: topshiriqlar tugash sanasi bo'yicha va **loyihalarning tugash sanasi** (binafsha belgi, bayroqcha bilan; dasturchi faqat o'z loyihalarini ko'radi).
- **Kun bosilsa** "Taqvim kuni" oynasi ochiladi: shu kuni tugaydigan loyihalar va shu kungi topshiriqlar.
- Ro'yxatdagi topshiriq (yoki loyiha) bosilsa, kun oynasi o'rniga uning oynasi ochiladi (modal ustida modal yo'q); "Orqaga" yoki ✕ kun ro'yxatiga qaytaradi.
- Kundagi topshiriq/loyiha belgisini to'g'ridan-to'g'ri bossa ham o'z oynasi ochiladi; "yana N ta" kun ro'yxatini ochadi.

### Loyihalar (`/loyihalar`, PM, Boshliq)
- Loyihalar ro'yxati: qidiruv, daraja filtri, har birida jarayon ("5 / 12 topshiriq bajarildi") va "Buyurtmadan" belgisi. Eng yangisi tepada.
- "Yangi loyiha" — 3 qadamli yaratish oynasi (5-bo'lim). Loyiha bosilsa loyiha oynasi ochiladi.

### Buyurtmalar (`/buyurtmalar`)
- PM/Boshliq uchun "Buyurtmalar (TZ)", Boshqarma uchun "Buyurtmalarim" (faqat o'z buyurtmalari).
- Filtrlar: **Hammasi** (birinchi, standart tanlangan) · Yangi · Tasdiqlangan · Rad etilgan.

### Xodimlar (`/xodimlar`, PM, Boshliq)
- Barcha jamoa a'zolari (dasturchilar, menejerlar): bandligi, faol va kechikkan topshiriqlari, hozir nima qilayotgani. Topshirig'i yo'qlar birinchi turadi.
- Bo'sh (topshirig'i yo'q yoki yuklamasi kam) xodimga to'g'ridan-to'g'ri topshiriq berish tugmasi.
- Topshiriq sub-vazifalarga ajratilib, ularga boshqa xodimlar biriktiriladi.
- Xodim bosilsa, xodim oynasi ochiladi: profil sarlavhasi, statistika, joriy ishlari, topshiriq berish.
- Boshliq o'z profilidagi **Xizmat safarlari** bo'limida faol PM yoki dasturchining qaytish sanasini belgilaydi yoki safarni muddatidan oldin tugatadi. Safar darhol boshlanadi; qaytish kuni yangi topshiriq berish avtomatik qayta ochiladi. Safardagi dasturchiga yangi topshiriq/sub-vazifa biriktirilmaydi; avvaldan biriktirilgan ishlar saqlanadi. Bu qoida serverda ham tekshiriladi.

### Tekshiruv navbati (`/tekshiruv`, PM, Boshliq)
- Tekshiruvga yuborilgan topshiriqlar ro'yxati, kim yuborgani bilan. "Ko'rib chiqish" topshiriq oynasini ochadi, qabul qilish yoki qaytarish shu yerda. Menyuda kutayotganlar soni ko'rinadi.

### Xabarlar (`/xabarlar`)
- Foydalanuvchilar orasida shaxsiy yozishma. Chapda suhbatlar ro'yxati va ism bo'yicha qidiruv, o'ngda suhbat. Telefonga moslangan.
- Rolsiz akkaunt ro'yxatda chiqmaydi, suhbatda oxirgi 200 xabar ko'rsatiladi.

### Bildirishnomalar (modal — qo'ng'iroq ikonkasi, 9-bo'lim)
- Alohida sahifa/menyu bandi emas — tepadagi qo'ng'iroq ikonkasi bosilganda modal ochiladi (2026-10-05).
- Kun bo'yicha guruhlangan (Bugun, Kecha, sana), har bir turning o'z rangli ikonkasi bor, o'qilmaganlar ajratib ko'rsatiladi.
- Sarlavha ostida o'qilmaganlar soni, "Hammasi / O'qilmagan" filtri, "Hammasini o'qildi deb belgilash". Bosilsa tegishli oyna ochiladi.
- Turlari: yangi buyurtma, buyurtma tasdiqlandi, buyurtma rad etildi, yangi TZ versiyasi, topshiriq berildi, tekshiruvga yuborildi, topshiriq qabul qilindi, topshiriq qaytarildi, yangi izoh, loyihani yakunlashga dasturchi tasdig'i so'raldi, dasturchi loyihani yakunlashni rad etdi, barcha dasturchilar tasdiqladi (PM/Boshliqqa), loyihani yakunlashni tasdiqlash so'raldi (boshqarmaga), loyihani yakunlash tasdiqlandi, loyihani yakunlash rad etildi.

### Takliflar (`/takliflar`, hamma)
- Tizimni yaxshilash bo'yicha g'oyalar. Taklif ochiq yoki **anonim** yuboriladi (sarlavha va matn).
- Hamma ovoz beradi (Yoqlaydi / Qarshi). Qarorni faqat **Boshliq** chiqaradi (izoh bilan).
- Holatlar: **Ko'rib chiqilmoqda → Qabul qilingan / Rad etilgan**. Taklif tahrirlanmaydi.

### Qilingan ishlar (`/qilingan-ishlar`, PM, Boshliq)
- 3 ta tab: **Topshiriqlar** (bajarilgan topshiriqlar, ijrochilar va sanasi), **Tekshiruvlar** (kim yubordi, kim tekshirdi, qaror, izoh), **Tarix** (tizimdagi amallar lentasi — kim nima qildi va qachon).
- Loyiha, oxirgi necha kun va **"Faqat men"** bo'yicha filtr, sahifalash. PM/Boshliq topshiriqqa ijrochi bo'la olmagani uchun "Faqat men" — o'zi yaratgan va yakunlangan topshiriqlar, o'zi tekshirib qabul/rad etgan ishlar va o'z amallari (Tarix tabida).

### Profil (`/profil`)
- Barcha profillar bir xil ko'rinishda (o'z profilim va xodim oynasi): umumiy `ProfileHeader` (avatar, ism, lavozim, 4 ko'rsatkich: faol, kechikkan, tekshiruvda, bajarilgan) va umumiy topshiriqlar jadvali (`TaskTable`). "Faol" soni hamma joyda bir xil qoida bilan hisoblanadi.
- Ism, familiya, Telegram username, parolni almashtirish. Telegram username o'zgarsa, eski chat uziladi (botga `/start` qayta yuboriladi).
- Dasturchi profilida **"Mening topshiriqlarim"** jadvali — faqat o'ziga biriktirilgan topshiriqlar.
- **Profil rasmi:** "Rasm yuklash" (keyin "Rasmni almashtirish" / "Rasmni o'chirish"). JPG, PNG yoki WEBP, 5 MB gacha. Server rasmni tekshiradi, 1024px gacha kichraytiradi, joylashuv kabi ichki ma'lumotlarni (EXIF) o'chiradi. Rasm faqat tizimga kirganlarga ko'rinadi.
- **Rasmni ko'rish:** profil sarlavhasidagi rasm (o'z profilim va xodim oynasi) bosilsa, Telegram kabi to'liq ekranda ochiladi: to'q fon, tepada ism va ✕. `Esc`, fonga bosish yoki "Orqaga" yopadi. Xodim oynasidan ochilsa, uning o'rnini egallaydi va "Orqaga" xodim oynasiga qaytaradi.
- **Avatar kartochkasi:** har qanday joyda (jadval, topshiriq oynasi, chat, menyu) avatar ustiga sichqoncha olib borilsa, kichik profil kartochkasi chiqadi: rasm, ism familiya, rol (Boshqarma bo'lsa, boshqarma nomi). Rasm bo'lmasa, bosh harflar. Kartochka modal emas.

### Izohlar
- Buyurtma, loyiha va topshiriq oynalarida izohlar bo'limi bor. Izoh yozilsa, ishtirokchilarga bildirishnoma boradi va tarixga yoziladi.

## 8. Telegram bildirishnomalari

- Bot: **@taskbildirishnomasi_bot** (`https://t.me/taskbildirishnomasi_bot`). Profildagi Telegram maydoni izohida botga havola bor (bot nomi serverdan: `/api/meta/` → `telegram_bot`).
- Ro'yxatdan o'tishda Telegram username (`@username`) yoziladi. Bitta username faqat bitta akkauntda bo'ladi (ro'yxatdan o'tishda ham, profilda ham tekshiriladi).
- Foydalanuvchi botga `/start` yozadi → akkaunti topilsa (faol, username bitta akkauntda), chat bog'lanadi.
- Shundan keyin tizimdagi har bir bildirishnoma Telegram'ga ham yuboriladi — faqat amal bazaga muvaffaqiyatli saqlangandan keyin, vaqt chegarasi (timeout) bilan.
- Token va bot nomi: `backend/.env` (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`) yoki muhit o'zgaruvchilari. `.env` gitga tushmaydi va **hech qachon commit qilinmaydi**. Token bo'sh bo'lsa Telegram o'chiq, tizim odatdagidek ishlaydi.
- Bot (`runbot`) server bilan birga avtomatik ishga tushadi (`backend/start_server.bat`, log: `backend/bot.log`). Logga token yozilmaydi.
- Bitta token bilan faqat **bitta** bot jarayoni ishlashi mumkin: boshqa joyda ham ishlasa, logda "409" chiqadi va `/start` xabarlari o'sha joyga ketadi.

## 9. Modallar (amalda: 13 ta)

Ko'rish, yaratish, tahrirlash — hammasi modalda. Batafsil: `docs/FLOWS_MODALS.md`.

| # | Modal | # | Modal |
|---|---|---|---|
| 1 | Buyurtma yaratish | 7 | Xodim profili |
| 2 | Buyurtma ko'rish (tasdiqlash / rad etish shu yerda) | 8 | Taklif yaratish |
| 3 | Loyiha yaratish (3 qadam) | 9 | Taklif ko'rish |
| 4 | Loyiha ko'rish / tahrirlash | 10 | Taqvim kuni |
| 5 | Topshiriq yaratish / tahrirlash (ommaviy yaratish ham) | 11 | Rasm ko'rish |
| 6 | Topshiriq ko'rish (tekshiruv shu yerda) | 12 | Bildirishnomalar (qo'ng'iroq ikonkasi) |
| 13 | Tekshiruvga yuborish (topshiriq oynasi ustida) |  |  |

Word ko'rish alohida modal emas — joriy modal ichini almashtiradi ("← Orqaga").

**Modal qoidalari:**
- Tepada sarlavha va ✕, o'rtada aylanuvchi tarkib, pastda doim ko'rinadigan tugmalar paneli (asosiy amal o'ngda, xavfli amal chapda).
- **Modal ustida modal ochilmaydi.** Ichki amal (rad etish sababi, sana kiritish) modal ichidagi pastki panelda bajariladi. Yagona istisno: "Tekshiruvga yuborish" modali topshiriq oynasi ustida ochiladi (foydalanuvchi qarori, 2026-10-05).
- Manzil satriga yozilmaydi: manzil toza qoladi (masalan `/qilingan-ishlar`, `?task=4` emas). Modal holati brauzer tarixida: "Orqaga" yopadi, sahifa yangilansa qayta ochiladi. Eski `?task=4` havolalar ishlaydi va darrov tozalanadi (`frontend/src/app/modals.tsx`).
- `Esc` yopadi, fokus modal ichida qoladi, saqlanmagan o'zgarish bo'lsa so'raydi. Telefonda butun ekran.
- Tugmalar rolga va holatga qarab chiqadi, keraksiz tugma ko'rsatilmaydi.

## 10. Flow'lar (amalda: 13 ta)

Cheklov: bitta bo'limda **3–4 ta flow**, istisnoda **5 ta**. Oshsa — flow'lar birlashtiriladi yoki bitta flow ichida holatga qarab UI almashadi.

| Bo'lim | Flow'lar |
|---|---|
| auth (1) | Ro'yxatdan o'tish va tasdiqlash |
| orders (3) | Buyurtma yuborish · Buyurtmani ko'rib chiqish · TZ qayta yuborish (v2, v3…) |
| projects (2) | Loyiha yaratish · Loyihani yakunlashni tasdiqlash |
| tasks (3) | Topshiriq yaratish va biriktirish · Topshiriqni bajarish · Tekshiruv |
| profile (1) | Profil tahrirlash (rasm va parol bilan) |
| suggestions (1) | Takliflar berish va ovoz |
| history (1) | Qilingan ishlar |
| notifications (1) | Telegram'ni ulash |

Batafsil bosqichlar: `docs/FLOWS_MODALS.md`.

## 11. Qabul qilingan qarorlar va ochiq savollar

**Qabul qilingan qarorlar:**
- **Muhimlik turi:** boshqarma buyurtma yuborganda tanlaydi, PM tasdiqlaganda o'zgartira oladi.
- **Mas'ul PM:** buyurtmani tasdiqlagan PM avtomatik mas'ul bo'ladi. Dasturchilar loyiha yaratilganda biriktiriladi.
- **Sub-vazifalar:** kichik qadamlar, har biriga bir nechta dasturchi biriktirish mumkin.
- **Xabarlar (chat):** foydalanuvchilar orasida shaxsiy yozishma.
- **Ommaviy topshiriqlar:** bir nechta topshiriqni matn shaklida birdaniga yaratish.
- **Mutaxassisliklar** Django adminda boshqariladi. Demo ro'yxat: Backend dasturchi, Frontend dasturchi, Mobil dasturchi, Dizayner, Tester, Loyiha menejeri, Boshqaruv.
- **Autentifikatsiya:** Cookie / Session (DRF standart), CSRF himoyasi bilan.
- **Fayl turlari va hajm:** .docx, .pdf, .png, .jpg, .jpeg — 20 MB gacha. Profil rasmi: JPG, PNG, WEBP — 5 MB gacha.
- **Takliflar bo'limi:** tizimni yaxshilash bo'yicha g'oyalar, qarorni Boshliq chiqaradi.
- **Yon panel (drawer) yo'q** — foydalanuvchini chalg'itmasligi uchun faqat modal va sahifalar.
- **"To'xtab qolgan" topshiriq holati yo'q.**
- **Topshiriqlar filtrida "Loyiha" va "Oy yarmi" yo'q** — o'rniga "Sanadan / Sanagacha" oralig'i.
- **Loyihani yakunlash:** avval loyihadagi barcha faol dasturchilar bildirishnoma orqali tasdiqlashi kerak (birortasi sababli rad etsa, yakunlanmaydi). Shundan keyin: buyurtmasiz loyiha to'g'ridan-to'g'ri yakunlanadi; buyurtmadan yaratilgan loyiha avval "Tasdiqlash kutilmoqda"ga o'tadi — faqat buyurtmani yuborgan boshqarma uni Yakunlangan deb tasdiqlaydi yoki sabab bilan Tuzatish kerak'ga qaytaradi. (Qaror: 2026-10-05.)

**Ochiq savollar:** hozircha yo'q.

## 12. Xavfsizlik

- Parollar Django parol hesh mexanizmi bilan saqlanadi. Kirish so'rovlari cheklangan (throttle).
- Har bir API so'rovda rol va egalik **serverda** tekshiriladi: boshqarma faqat o'z buyurtmasini, dasturchi faqat o'z topshirig'i va loyihasini ko'radi.
- Buyurtma yuborilgach boshqarma uni tahrirlay ham, o'chira ham olmaydi.
- Fayl yuklashda tur va hajm tekshiriladi. Yuklangan fayllar ochiq berilmaydi — faqat `/api/files/...` orqali ruxsat tekshiruvi bilan. Profil rasmlari — `/api/avatars/<id>/`, faqat tizimga kirganlarga.
- Maxfiy ma'lumotlar (`DJANGO_SECRET_KEY`, Telegram token) muhit o'zgaruvchilarida yoki `backend/.env` da; `DEBUG=0` bo'lganda maxfiy kalitsiz server ishga tushmaydi.

## 13. Ishga tushirish va demo loginlar

### Demo foydalanuvchilar

`seed_demo` buyrug'i yaratadi (faqat `DEBUG` rejimida). Parol hammasida: `Demo-parol-2026`.

| Login | Ism | Rol | Mutaxassislik / Boshqarma |
|---|---|---|---|
| `boshliq` | Akmal Karimov | Boshliq | Boshqaruv |
| `pm` | Sardor Rustamov | Loyiha menejeri | Loyiha menejeri |
| `jasur` | Jasur Alimov | Dasturchi | Backend dasturchi |
| `malika` | Malika Karimova | Dasturchi | Frontend dasturchi |
| `bobur` | Bobur Rahimov | Dasturchi | Mobil dasturchi |
| `it_boshqarma` | Shoxrux Hamidov | Boshqarma | Axborot texnologiyalari boshqarmasi |

Django admin (`/admin/`): lokal bazada `admin` superuser (parol: `Admin-parol-2026`). Yangi bazada `createsuperuser` bilan yaratiladi — `seed_demo` uni yaratmaydi.

### 1. Backend

```bash
cd backend
.venv\Scripts\python -m pip install -r requirements.txt   # bog'liqliklar
.venv\Scripts\python manage.py migrate                    # baza
.venv\Scripts\python manage.py createsuperuser            # admin (Boshliqni adminda yaratish uchun)
.venv\Scripts\python manage.py seed_demo                  # demo ma'lumotlar
.venv\Scripts\python manage.py runserver 127.0.0.1:8020   # http://127.0.0.1:8020/
.venv\Scripts\python manage.py test                       # backend testlari
.venv\Scripts\python manage.py makemigrations --check --dry-run   # sxema mosligi
.venv\Scripts\python manage.py runbot                     # Telegram bot (token backend\.env da)
```

### 2. Frontend — ishlab chiqish

```bash
cd frontend
npm install
npx vite                  # http://127.0.0.1:5173/ (API so'rovlari 8020 ga proksi qilinadi)
npx tsc --noEmit -p .     # TypeScript tur tekshiruvi
npx vitest run            # frontend testlari (jsdom + Testing Library)
```

### 3. Production build (ishlashi uchun Node kerak emas)

```bash
cd frontend
npx vite build            # frontend/dist ga yig'adi
```

Build'dan keyin frontend Django orqali `http://127.0.0.1:8020/` manzilida ochiladi.

### 4. Avtomatik ishga tushirish (Windows)

- Kompyuterga kirilganda `Startup` papkasidagi `TeamFlow.vbs` yashirin oynada `backend/start_server.bat` ni ishga tushiradi → `http://127.0.0.1:8020/`. Server logi: `backend/server.log`, bot logi: `backend/bot.log`.
- O'chirish: `shell:startup` papkasidan `TeamFlow.vbs` ni o'chiring.
- Frontend o'zgarsa, `npx vite build` qilish kerak.
- Backend kodi o'zgarsa, server qayta ishga tushiriladi (avtoishga tushirish `--noreload` bilan ishlaydi): `shell:startup\TeamFlow.vbs` ni qayta bosing yoki kompyuterni qayta yoqing.

### 5. Qaytarish nuqtalari (git tag)

Har doim avvalgi holatga qaytish imkoniyati saqlanadi: `v1.0-baseline`, `ui-before-restyle` (UI uslubi yangilanishidan oldin), `before-multi-assignee` (bir nechta ijrochidan oldin).

## 14. Papka tuzilmasi

```
backend/    Django: config/ (settings, urls), apps/ (core, accounts, orders, projects,
            tasks, notifications, panel, chat, suggestions), start_server.bat
frontend/   React + TS: src/app (marshrut, menyu, modallar), src/features (sahifalar),
            src/shared (UI komponentlar, text.ts, styles.css, types)
docs/       ARCHITECTURE.md, FLOWS_MODALS.md
```

- Har bir app ichidagi qatlamlar: `models`, `workflow`, `services`, `permissions`, `serializers`, `api`, `admin`, `tests` (batafsil: `docs/ARCHITECTURE.md` 3-bo'lim).
- Holat o'tishlari faqat `apps/*/workflow.py` jadvallarida. Kim nimani ko'rishi — `apps/*/permissions.py`.
- UI matnlari bitta joyda: `frontend/src/shared/text.ts`. Ranglar va o'lchamlar — `styles.css` tokenlari, sanalar — `formatDate`.
- Vaqtinchalik skriptlar: `backend/scratch/`, `frontend/scratch/`, `docs/scratch/` (ildizda faqat `backend`, `frontend`, `docs` va hujjatlar).

## 15. UX maqsadi

Auditoriya **18–40 yosh**. Interfeys ko'rgan zahoti tushunarli, o'qitish kerak emas:
- qisqa va oddiy o'zbekcha so'zlar, texnik atama yo'q;
- har ekranda bitta asosiy amal, ikonka doim matn bilan;
- tanish naqshlar: doska, sudrab o'tkazish, qidiruv;
- bo'sh holatda keyingi qadam tushuntiriladi, xatoda nima qilish kerakligi yoziladi;
- muddat rang va matn bilan ("5 kun qoldi"), bo'sh maydonlar yashiriladi;
- yuklanganda skeleton, xato maydon yonida; 8px setka, bitta asosiy rang, tungi/kunduzgi rejim, telefonda ishlaydi;
- SaaS darajasidagi zamonaviy, sodda ko'rinish, keraksiz bezak va uzun matn yo'q.

Batafsil qoidalar: `CLAUDE.md` 4-bo'lim. Dizayn oldingi loyiha skrinshotlaridan nusxa ko'chirilmaydi.

## 16. Ish qoidalari

- "Boshla" degunicha kod yozilmaydi.
- Faqat foydalanuvchi aytgan narsa qilinadi, o'zboshimchalik yo'q. Taklif bo'lsa, avval aytiladi.
- Yangi talablar `CLAUDE.md` / `GEMINI.md` 13-bo'limiga sana bilan va shu `README.md` ga qo'shiladi. Noaniq narsa "Ochiq savollar" ga yoziladi.
- Yangi flow yoki modal `docs/FLOWS_MODALS.md` ga yoziladi, cheklov haqida foydalanuvchiga aytiladi.
- Commit va push faqat foydalanuvchi so'raganda.
