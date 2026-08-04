# TeamFlow — Flow va Modal reestri

> Yangi flow yoki modal qo'shishdan oldin shu ro'yxatni tekshir. O'xshashi bo'lsa, uni kengaytir.
> Cheklov: bitta bo'limda **3–4 ta flow**, istisnoda **5 ta**. Modallar amalda **6 ta**.
> Holat: kod to'liq yozilgan va sinovdan o'tgan (2026-09-28). Barcha flow va modallar **Faol**.

## Flow'lar

| # | Nomi | Bo'lim | Bosqichlar (qisqa) | Holati |
|---|---|---|---|---|
| 1 | Ro'yxatdan o'tish va tasdiqlash | auth | Forma → "Tasdiqlanmagan" → Django adminda faollashtirish → Kirish | Faol |
| 2 | Buyurtma yuborish | orders | Boshqarma nom, izoh, TZ, muddat kiritadi → Yuborildi | Faol |
| 3 | Buyurtmani ko'rib chiqish | orders | PM ochadi → Tasdiqlash (sana, izoh) yoki Rad etish (sabab) | Faol |
| 4 | TZ qayta yuborish (v2, v3…) | orders | Rad etilgach kamchilikni tuzatib yangi TZ yuboriladi | Faol |
| 5 | Loyiha yaratish | projects | Tasdiqlangan buyurtmadan (yoki qo'lda) → jamoa → vazifalar/fayllar | Faol |
| 6 | Vazifa yaratish va biriktirish | tasks | Loyiha ichida vazifa → bir yoki bir nechta dasturchi → sub-vazifalar | Faol |
| 7 | Vazifani bajarish | tasks | Nazoratda → Jarayonda → Tekshiruvga yuborish (izoh, fayl) | Faol |
| 8 | Tekshiruv | tasks | PM natijani ko'radi → Qabul (Bajarildi) yoki Qaytarish (Jarayonda, izoh bilan) | Faol |

Bo'limlar bo'yicha son: auth 1 · orders 3 · projects 1 · tasks 3. Cheklovdan oshmagan.
Eslatma: `orders` bo'limidagi 3 flow ham UI da bitta "buyurtma holati" oqimi sifatida (holatga qarab tugma almashadi) amalga oshiriladi, alohida sahifalar ko'paytirilmaydi.

## Modallar (amalda: 6 ta)

Modallar URL parametrlariga bog'langan (`?task=12`, `?order=5`, `?project=3`, `?new=task|order|project`).

| # | Nomi | Kim ishlatadi | Vazifasi | Parametr | Holati |
|---|---|---|---|---|---|
| 1 | Buyurtma yaratish | Boshqarma | Nom, izoh, muddat, muhimlik, TZ fayli (.docx/.pdf) | `?new=order` | Faol |
| 2 | Buyurtma ko'rish | Hamma (rolga qarab) | Ma'lumotlar, TZ, tarix, izohlar; PM uchun Tasdiqlash/Rad etish; Boshqarma uchun Yangi TZ versiyasi | `?order=:id` | Faol |
| 3 | Loyiha yaratish | PM, Boshliq | 3 qadam: Asosiy → Jamoa → Vazifalar va fayllar | `?new=project` | Faol |
| 4 | Loyiha ko'rish/tahrirlash | PM, Boshliq, Dasturchi | Ma'lumot, daraja, jamoa, fayllar, sanalarni o'zgartirish | `?project=:id` | Faol |
| 5 | Vazifa yaratish/tahrirlash | PM, Boshliq, Dasturchi | Nom, izoh, ijrochilar, muddat, sub-vazifalar, fayllar | `?new=task` / `?edit=:id` | Faol |
| 6 | Vazifa ko'rish | Hamma (rolga qarab) | Ma'lumot, sub-vazifalar, tekshiruv (yuborish/qabul/qaytarish), izohlar, fayllar | `?task=:id` | Faol |

Modal bo'lmagan yordamchi qatlamlar: dasturchi tafsilotlari uchun yon panel (drawer), o'chirish/tasdiqlash uchun kichik tasdiq dialogi.

## Birlashtirilgan / bekor qilingan

| Nomi | Nimaga | Sana |
|---|---|---|
| Tekshiruv natijasi | "Vazifa ko'rish" modaliga tekshiruv tabi sifatida birlashtirildi (alohida modal ochilmaydi) | 2026-09-28 |
| Word ko'rish | Modal ustida modal ochmaslik uchun joriy modal ichini almashtiradi va "← Orqaga" tugmasi bilan qaytadi | 2026-09-28 |

## Ogohlantirishlar tarixi

| Sana | Bo'lim | Flow soni | Izoh |
|---|---|---|---|
| — | — | — | — |
