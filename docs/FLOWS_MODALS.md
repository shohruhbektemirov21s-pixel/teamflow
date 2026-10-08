# TeamFlow — Flow va Modal reestri

> Yangi flow yoki modal qo'shishdan oldin shu ro'yxatni tekshir. O'xshashi bo'lsa, uni kengaytir.
> Cheklov: bitta bo'limda **3–4 ta flow**, istisnoda **5 ta**. Modallar amalda **16 ta** (reja 8 ta edi — yangi modal kerak bo'lsa, avval mavjudini kengaytirish ko'rib chiqiladi).
> Holat: kod to'liq yozilgan va sinovdan o'tgan (2026-09-28). Barcha flow va modallar **Faol**.

## Flow'lar

| # | Nomi | Bo'lim | Bosqichlar (qisqa) | Holati |
|---|---|---|---|---|
| 1 | Ro'yxatdan o'tish va tasdiqlash | auth | Forma → "Tasdiqlanmagan" → Django adminda faollashtirish → Kirish | Faol |
| 2 | Buyurtma yuborish | orders | Boshqarma nom, izoh, TZ, muddat kiritadi → Yuborildi | Faol |
| 3 | Buyurtmani ko'rib chiqish | orders | PM ochadi → Tasdiqlash (sana, izoh) yoki Rad etish (sabab) | Faol |
| 4 | TZ qayta yuborish (v2, v3…) | orders | Rad etilgach kamchilikni tuzatib yangi TZ yuboriladi | Faol |
| 5 | Loyiha yaratish | projects | Tasdiqlangan buyurtmadan (yoki qo'lda) → jamoa → loyiha fayllari va har bir xodimga alohida vazifa (sana, fayl) → bitta tranzaksiyada saqlanadi | Faol |
| 5b | Loyihani yakunlashni tasdiqlash | projects | PM/Boshliq "Yakunlash" bosadi → alohida modalda izoh va fayllar → yuboradi → loyihadagi barcha faol dasturchilarga bildirishnoma (Ha/Yo'q tugmasi bilan) → birortasi sabab bilan rad etsa yakunlanmaydi (loyiha davom etadi, PM sababni ko'radi, qayta so'raganda hammadan yangidan so'raladi) → hammasi "Ha" desa PMga xabar keladi va "Yakunlash" tugmasi ochiladi; PM yakunlaydi: buyurtmasiz loyiha darrov yakunlanadi; buyurtmali loyiha "Tasdiqlash kutilmoqda"ga o'tadi → buyurtmani yuborgan boshqarma (OrderModal) Tasdiqlaydi (Yakunlangan) yoki sabab bilan Rad etadi (Rad etildi, PM qayta so'raydi) | Faol (2026-10-05) |
| 6 | Vazifa yaratish va biriktirish | tasks | Loyiha ichida vazifa → bir yoki bir nechta dasturchi → sub-vazifalar (har biriga bir nechta dasturchi). Vazifa oynasidan keyin ham ijrochi qo'shiladi (PM/Boshliq; dasturchi — o'zi yaratgan vazifaga), jamoadan tashqari dasturchi loyihaga avtomatik qo'shiladi | Faol |
| 7 | Vazifani bajarish | tasks | Nazoratda → Jarayonda → Tekshiruvga yuborish (izoh, fayl) | Faol |
| 8 | Tekshiruv | tasks | PM natijani ko'radi → Qabul (Bajarildi) yoki Qaytarish (Jarayonda, izoh bilan) | Faol |
| 9 | Profil tahrirlash | profile | Ma'lumotlarni tahrirlash, profil rasmini yuklash/o'chirish va parol almashtirish | Faol |
| 10 | Takliflar berish va ovoz | suggestions | Taklif yaratish, ovoz berish, boshliq qarori | Faol |
| 11 | Qilingan ishlar feed | history | Oxirgi bajarilgan vazifalar va tekshiruvlar reyestri (Boss, PM) | Faol |
| 12 | Telegram'ni ulash | notifications | Ro'yxatdan o'tishda @username → botga /start → chat bog'lanadi → bildirishnomalar Telegram'ga ham keladi | Faol |
| 13 | Portfoliolarni ko'rish va kuzatish | portfolio | Menyu "Portfolio" → dasturchilar reyting bo'yicha (eng balandi tepada, o'rni, yulduz, kuzatuvchi/sharh/loyiha soni) → qator bosiladi → "Portfolio" modali (tajriba, yillar bo'yicha, loyihalar, bajarilgan vazifalar) → "Kuzatish" / "Kuzatishni to'xtatish". Hamma rol ko'radi | Faol (2026-10-08) |
| 14 | Portfolioni to'ldirish | portfolio | Dasturchi "Mening portfoliom" → TeamFlow loyihalari o'zi paydo bo'lgan → "Loyiha qo'shish" (nom, sanalar, tavsif, havola) → loyiha ichida video yuklash (MP4/WebM/MOV, 100 MB, 5 tagacha) / tahrirlash / o'chirish | Faol (2026-10-08) |
| 15 | Loyihani baholash va sharh | portfolio | Boshqa foydalanuvchi loyihani ochadi → 1–5 yulduz + sharh (ixtiyoriy) → "Bahoni saqlash" (keyin yangilash/o'chirish). Dasturchi reytingi — barcha loyihalaridagi baholar o'rtachasi | Faol (2026-10-08) |

Bo'limlar bo'yicha son: auth 1 · orders 3 · projects 2 · tasks 3 · profile 1 · history 1 · suggestions 1 · notifications 1 · portfolio 3. Cheklovdan oshmagan.
Eslatma: `orders` bo'limidagi 3 flow ham UI da bitta "buyurtma holati" oqimi sifatida (holatga qarab tugma almashadi) amalga oshiriladi, alohida sahifalar ko'paytirilmaydi.

## Modallar (amalda: 16 ta)

Modal holati brauzer tarixida saqlanadi, manzil satri toza qoladi. Quyidagi "Parametr" ustuni — `useModal().open()` ga beriladigan qiymat (eski `?task=12` havolalar ham ishlaydi va tozalanadi).

| # | Nomi | Kim ishlatadi | Vazifasi | Parametr | Holati |
|---|---|---|---|---|---|
| 1 | Buyurtma yaratish | Boshqarma | Nom, izoh, muddat, muhimlik, TZ fayli (.docx/.pdf) | `?new=order` | Faol |
| 2 | Buyurtma ko'rish | Hamma (rolga qarab) | Ma'lumotlar, TZ, tarix, izohlar; PM uchun Tasdiqlash/Rad etish; Boshqarma uchun Yangi TZ versiyasi | `?order=:id` | Faol |
| 3 | Loyiha yaratish | PM, Boshliq | 3 qadam: Asosiy → Jamoa → Vazifalar va fayllar (har bir xodimga alohida vazifa: nom, boshlanish/tugash vaqti, fayllar) | `?new=project` | Faol |
| 4 | Loyiha ko'rish/tahrirlash | PM, Boshliq, Dasturchi | Ma'lumot, daraja, jamoa, fayllar, sanalarni o'zgartirish | `?project=:id` | Faol |
| 5 | Vazifa yaratish/tahrirlash | PM, Boshliq, Dasturchi | Nom, izoh, ijrochilar, muddat, sub-vazifalar, fayllar; ommaviy yaratishda har vazifaga alohida ijrochi | `?new=task` / `?edit=:id` / `?bulk=task` | Faol |
| 6 | Vazifa ko'rish | Hamma (rolga qarab) | Mobilga mos yig'iladigan bo'limlar: ma'lumot, sub-vazifalar, tekshiruv, ish jurnali, izohlar, fayllar. Ijrochilar va sub-vazifa ijrochilari shu modal ichidagi panelda o'zgartiriladi (yangi modal yo'q, `DeveloperPicker`). "Tekshiruvga yuborish" / "Qaytarish" — ustida ochiladigan 13-modal | `?task=:id` (`submit: true` — darrov yuborish ekrani) | Faol |
| 7 | Xodim profili | Boshliq, PM | Xodim statistikasi, Boshliq/PM kiritadigan mas'uliyatlar, barcha vazifalari, dasturchi hisoboti, biriktirilgan loyihalar va vazifa berish; ish/loyiha bosilsa mavjud tafsilot oynasi ochiladi | `?person=:id` | Faol |
| 8 | Taklif yaratish | Hamma | Anonim yoki ochiq taklif matni, sarlavha kiritish | `?new=suggestion` | Faol |
| 9 | Taklif ko'rish | Hamma | Taklif tafsilotlari, ovoz berish (yoqlash/qarshi), Boshliq qabul/rad qilish | `?suggestion=:id` | Faol |
| 10 | Taqvim kuni | Dasturchi, PM, Boshliq | Shu kuni tugaydigan loyihalar va shu kungi vazifalar ro'yxati; bosilsa shu modal o'rniga "Vazifa ko'rish" / "Loyiha ko'rish" ochiladi, "Orqaga" qaytaradi (`features/calendar/DayModal.tsx`) | `{ day: "yyyy-mm-dd" }` | Faol (2026-09-30) |
| 11 | Rasm ko'rish | Hamma | Profil rasmi Telegram kabi to'liq ekranda (to'q fon, tepada ism va ✕). Profil sarlavhasidagi rasm bosilganda ochiladi; xodim oynasidan ochilsa uning o'rnini egallaydi, "Orqaga" qaytaradi (`features/people/PhotoModal.tsx`) | `{ photo: id, name, src }` | Faol (2026-09-30) |
| 12 | Bildirishnomalar | Hamma | Kun bo'yicha guruhlangan ro'yxat, "Hammasi/O'qilmagan" filtri, "Hammasini o'qildi deb belgilash"; bosilsa tegishli modal (vazifa/buyurtma/loyiha) shu modal o'rniga ochiladi. Avval alohida sahifa edi (`/bildirishnomalar`), endi faqat tepadagi qo'ng'iroq ikonkasi ochadi, chap menyuda band yo'q (`features/notifications/NotificationsModal.tsx`) | `{ notifications: true }` | Faol (2026-10-05) |
| 13 | Vazifa amali | Dasturchi (yuborish), PM/Boshliq (qaytarish) | Vazifa oynasi **ustida** qora fonli alohida modal: "Nima qildingiz?" (1000 belgi, hisoblagich), drag&drop fayl zonasi; qaytarishda — sabab. Vazifa oynasi orqada `inert` (`TaskActionScreen`, `Modal stacked`) | vazifa oynasi ichidan / `submit: true` | Faol (2026-10-06) |
| 14 | Buyurtma amali | PM/Boshliq, Boshqarma | Buyurtma oynasi **ustida** qora fonli alohida modal: Tasdiqlash (sanalar, muhimlik, izoh), Rad etish (sabab), Sanani o'zgartirish, Yangi TZ, Kamchilik bor (`OrderModal.tsx`, `Modal stacked`) | buyurtma oynasi ichidan | Faol (2026-10-06) |
| 15 | Loyiha yakunlash amali | PM, Boshliq | Loyiha oynasi ustida izoh va fayllarni yuborish; orqadagi loyiha ko'rinadi, inert. Mavjud yakunlash tasdiqlash jarayoni saqlanadi | loyiha oynasi ichidan | Faol (2026-10-06) |
| 16 | Portfolio | Hamma | Bitta modal, ichida 3 ko'rinish (modal ustida modal yo'q): dasturchi sahifasi (ko'rsatkichlar, loyihalar, yillar, vazifalar, kuzatish/loyiha qo'shish) → loyiha (video, havola, baho va sharhlar; egasiga tahrirlash/video) → yangi loyiha formasi. Loyiha/forma "← Orqaga" yoki ✕ bilan dasturchi sahifasiga qaytadi (`features/portfolio/PortfolioModal.tsx`, `PortfolioItem.tsx`) | `{ portfolio: id }`, `{ portfolio, item }`, `{ portfolio, add: true }` | Faol (2026-10-08) |

> Yon panellar (drawer) butunlay taqiqlangan, faqat modal va sahifalardan foydalaniladi.

## Birlashtirilgan / bekor qilingan

| Nomi | Nimaga | Sana |
|---|---|---|
| Tekshiruv natijasi | "Vazifa ko'rish" modaliga tekshiruv tabi sifatida birlashtirildi (alohida modal ochilmaydi) | 2026-09-28 |
| Word ko'rish | Modal ustida modal ochmaslik uchun joriy modal ichini almashtiradi va "← Orqaga" tugmasi bilan qaytadi | 2026-09-28 |
| PersonDrawer | "Yon panel chalg'itadi" qoidasi asosida `PersonModal` ga almashtirildi | 2026-09-28 |

## Ogohlantirishlar tarixi

| Sana | Bo'lim | Flow soni | Izoh |
|---|---|---|---|
| 2026-09-30 | calendar | 0 (yangi flow emas) | "Taqvim kuni" modali qo'shildi — modallar 10 ta, rejadagi 8 tadan oshdi. Foydalanuvchiga aytildi. Mavjud modallardan birortasi kun ro'yxatini ko'rsatmaydi, shuning uchun kengaytirish o'rniga yangisi. |
| 2026-09-30 | profile | 0 (yangi flow emas, flow 9 kengaydi) | "Rasm ko'rish" modali qo'shildi — modallar 11 ta. Foydalanuvchiga aytildi. Telegram kabi to'liq ekranli ko'rinish mavjud modal kartasiga (sarlavha + tarkib + tugmalar) sig'maydi; umumiy `useDialogBehavior` (Esc, fokus) bilan yozildi. |
| 2026-10-05 | notifications | 0 (yangi flow emas) | "Bildirishnomalar" sahifasi (`/bildirishnomalar`, `NotificationsPage.tsx`) modalga aylantirildi (`NotificationsModal.tsx`) — modallar 12 ta. Sabab: chap menyudagi "Bildirishnomalar" bandi tepadagi qo'ng'iroq ikonkasi bilan ikki marta bir joyga havola edi (foydalanuvchi so'rovi bilan band olib tashlandi), shundan keyin qo'ng'iroq sahifaga emas, modalga ochilishi so'raldi. Mavjud modal kartasiga (sarlavha + filtr + ro'yxat + "hammasini o'qildi" tugmasi) sig'di, yangi infratuzilma kerak bo'lmadi. |
| 2026-10-06 | tasks, orders | 0 (yangi flow emas) | Foydalanuvchi talabi bilan "modal ustida modal yo'q" qoidasidan istisno: vazifa va buyurtma oynasidagi amal panellari asosiy oyna ustida qora fonli alohida modalga aylandi — modallar 12 → 14 ta. Foydalanuvchiga aytildi. Umumiy `Modal` endi ustma-ust oynalarni qo'llaydi (Esc/Tab faqat ustdagisiga, orqadagisi `inert`). |
| 2026-10-08 | portfolio | 3 (yangi bo'lim) | Dasturchi portfoliosi: 3 ta flow (ko'rish va kuzatish · to'ldirish · baholash). Foydalanuvchi "flow'lar 3–5 tadan oshmasin" dedi — kuzatish alohida flow emas, ko'rish ichida. Modallar 15 → 16: "Xodim profili" faqat menejerlar uchun va ichki ish ma'lumotlari bor, shuning uchun hammaga ochiq portfolio uchun kengaytirilmadi; loyiha va forma alohida modal emas, shu modal ichini almashtiradi. Foydalanuvchiga aytildi. |

## UX/UI tartibi (2026-10-06)

Mavjud sahifa va modallar umumiy tugma tartibiga keltirildi: sahifada qidiruv/filtrlar chapda, amallar o'ngda; modalda xavfli amallar chapda, asosiy amal o'ngda. Yakunlash pastki panelda. Telefon ekranida modal sarlavhasi amallari alohida qatorda va buyurtma holati nomi ostida. Yangi flow yoki modal qo'shilmadi. Boshqarma buyurtmalar ro'yxati: tasdiq kutilayotgan yakunlashlar ? yangi/faol buyurtmalar ? to'liq yakunlanganlar; guruh ichida yangilari oldin.
