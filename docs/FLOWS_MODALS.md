# TeamFlow — Flow va Modal reestri

> Yangi flow yoki modal qo'shishdan oldin shu ro'yxatni tekshir. O'xshashi bo'lsa, uni kengaytir.
> Cheklov: bitta bo'limda **3–4 ta flow**, istisnoda **5 ta**. Modallar amalda **13 ta** (reja 8 ta edi — yangi modal kerak bo'lsa, avval mavjudini kengaytirish ko'rib chiqiladi).
> Istisno (2026-10-05, foydalanuvchi so'rovi): "Modal ustida modal ochilmaydi" qoidasidan **bitta aniq joyda** chetga chiqilgan — pastga qarang, modal 13.
> Holat: kod to'liq yozilgan va sinovdan o'tgan (2026-09-28). Barcha flow va modallar **Faol**.

## Flow'lar

| # | Nomi | Bo'lim | Bosqichlar (qisqa) | Holati |
|---|---|---|---|---|
| 1 | Ro'yxatdan o'tish va tasdiqlash | auth | Forma → "Tasdiqlanmagan" → Django adminda faollashtirish → Kirish | Faol |
| 2 | Buyurtma yuborish | orders | Boshqarma nom, izoh, TZ, muddat kiritadi → Yuborildi | Faol |
| 3 | Buyurtmani ko'rib chiqish | orders | PM ochadi → Tasdiqlash (sana, izoh) yoki Rad etish (sabab) | Faol |
| 4 | TZ qayta yuborish (v2, v3…) | orders | Rad etilgach kamchilikni tuzatib yangi TZ yuboriladi | Faol |
| 5 | Loyiha yaratish | projects | Tasdiqlangan buyurtmadan (yoki qo'lda) → jamoa → loyiha fayllari va har bir xodimga alohida vazifa (sana, fayl) → bitta tranzaksiyada saqlanadi | Faol |
| 5b | Loyihani yakunlashni tasdiqlash | projects | PM/Boshliq "Yakunlangan" tanlaydi → loyihadagi barcha faol dasturchilarga bildirishnoma (Ha/Yo'q tugmasi bilan) → birortasi sabab bilan rad etsa yakunlanmaydi (loyiha davom etadi, PM sababni ko'radi, qayta so'raganda hammadan yangidan so'raladi) → hammasi "Ha" desa: buyurtmasiz loyiha darrov yakunlanadi; buyurtmali loyiha "Tasdiqlash kutilmoqda"ga o'tadi → buyurtmani yuborgan boshqarma (OrderModal) Tasdiqlaydi (Yakunlangan) yoki sabab bilan Rad etadi (Tuzatish kerak, PM qayta so'raydi) | Faol (2026-10-05) |
| 6 | Vazifa yaratish va biriktirish | tasks | Loyiha ichida vazifa → bir yoki bir nechta dasturchi → sub-vazifalar (har biriga bir nechta dasturchi). Vazifa oynasidan keyin ham ijrochi qo'shiladi (PM/Boshliq; dasturchi — o'zi yaratgan vazifaga), jamoadan tashqari dasturchi loyihaga avtomatik qo'shiladi | Faol |
| 7 | Vazifani bajarish | tasks | Nazoratda → Jarayonda → Tekshiruvga yuborish (izoh, fayl). Menejer (PM/Boshliq) ijrochi bo'lmay yuborsa — avval vazifaning barcha faol ijrochilaridan tasdiq so'raladi (bildirishnoma, Ha/Yo'q); hammasi tasdiqlasa avtomatik Tekshiruvdaga o'tadi, birortasi rad etsa (sabab bilan) joyida qoladi. Ijrochining o'zi tasdiqsiz to'g'ridan-to'g'ri yuboradi | Faol (2026-10-05) |
| 8 | Tekshiruv | tasks | PM natijani ko'radi → Qabul (Bajarildi) yoki Qaytarish (Jarayonda, izoh bilan) | Faol |
| 9 | Profil tahrirlash | profile | Ma'lumotlarni tahrirlash, profil rasmini yuklash/o'chirish va parol almashtirish | Faol |
| 10 | Takliflar berish va ovoz | suggestions | Taklif yaratish, ovoz berish, boshliq qarori | Faol |
| 11 | Qilingan ishlar feed | history | Oxirgi bajarilgan vazifalar va tekshiruvlar reyestri (Boss, PM) | Faol |
| 12 | Telegram'ni ulash | notifications | Ro'yxatdan o'tishda @username → botga /start → chat bog'lanadi → bildirishnomalar Telegram'ga ham keladi | Faol |

Bo'limlar bo'yicha son: auth 1 · orders 3 · projects 2 · tasks 3 · profile 1 · history 1 · suggestions 1 · notifications 1. Cheklovdan oshmagan.
Eslatma: `orders` bo'limidagi 3 flow ham UI da bitta "buyurtma holati" oqimi sifatida (holatga qarab tugma almashadi) amalga oshiriladi, alohida sahifalar ko'paytirilmaydi.

## Modallar (amalda: 13 ta)

Modal holati brauzer tarixida saqlanadi, manzil satri toza qoladi. Quyidagi "Parametr" ustuni — `useModal().open()` ga beriladigan qiymat (eski `?task=12` havolalar ham ishlaydi va tozalanadi).

| # | Nomi | Kim ishlatadi | Vazifasi | Parametr | Holati |
|---|---|---|---|---|---|
| 1 | Buyurtma yaratish | Boshqarma | Nom, izoh, muddat, muhimlik, TZ fayli (.docx/.pdf) | `?new=order` | Faol |
| 2 | Buyurtma ko'rish | Hamma (rolga qarab) | Ma'lumotlar, TZ, tarix, izohlar; PM uchun Tasdiqlash/Rad etish; Boshqarma uchun Yangi TZ versiyasi | `?order=:id` | Faol |
| 3 | Loyiha yaratish | PM, Boshliq | 3 qadam: Asosiy → Jamoa → Vazifalar va fayllar (har bir xodimga alohida vazifa: nom, boshlanish/tugash vaqti, fayllar) | `?new=project` | Faol |
| 4 | Loyiha ko'rish/tahrirlash | PM, Boshliq, Dasturchi | Ma'lumot, daraja, jamoa, fayllar, sanalarni o'zgartirish | `?project=:id` | Faol |
| 5 | Vazifa yaratish/tahrirlash | PM, Boshliq, Dasturchi | Nom, izoh, ijrochilar, muddat, sub-vazifalar, fayllar; ommaviy yaratishda har vazifaga alohida ijrochi | `?new=task` / `?edit=:id` / `?bulk=task` | Faol |
| 6 | Vazifa ko'rish | Hamma (rolga qarab) | Mobilga mos yig'iladigan bo'limlar: ma'lumot, sub-vazifalar, tekshiruv, ish jurnali, izohlar, fayllar. Ijrochilar va sub-vazifa ijrochilari shu modal ichidagi panelda o'zgartiriladi (yangi modal yo'q, `DeveloperPicker`) | `?task=:id` | Faol |
| 7 | Xodim profili | Boshliq, PM | Xodim statistikasi, joriy ishlari va to'g'ridan-to'g'ri vazifa berish (Drawer o'rniga keldi) | `?person=:id` | Faol |
| 8 | Taklif yaratish | Hamma | Anonim yoki ochiq taklif matni, sarlavha kiritish | `?new=suggestion` | Faol |
| 9 | Taklif ko'rish | Hamma | Taklif tafsilotlari, ovoz berish (yoqlash/qarshi), Boshliq qabul/rad qilish | `?suggestion=:id` | Faol |
| 10 | Taqvim kuni | Dasturchi, PM, Boshliq | Shu kuni tugaydigan loyihalar va shu kungi vazifalar ro'yxati; bosilsa shu modal o'rniga "Vazifa ko'rish" / "Loyiha ko'rish" ochiladi, "Orqaga" qaytaradi (`features/calendar/DayModal.tsx`) | `{ day: "yyyy-mm-dd" }` | Faol (2026-09-30) |
| 11 | Rasm ko'rish | Hamma | Profil rasmi Telegram kabi to'liq ekranda (to'q fon, tepada ism va ✕). Profil sarlavhasidagi rasm bosilganda ochiladi; xodim oynasidan ochilsa uning o'rnini egallaydi, "Orqaga" qaytaradi (`features/people/PhotoModal.tsx`) | `{ photo: id, name, src }` | Faol (2026-09-30) |
| 12 | Bildirishnomalar | Hamma | Kun bo'yicha guruhlangan ro'yxat, "Hammasi/O'qilmagan" filtri, "Hammasini o'qildi deb belgilash"; bosilsa tegishli modal (vazifa/buyurtma/loyiha) shu modal o'rniga ochiladi. Avval alohida sahifa edi (`/bildirishnomalar`), endi faqat tepadagi qo'ng'iroq ikonkasi ochadi, chap menyuda band yo'q (`features/notifications/NotificationsModal.tsx`) | `{ notifications: true }` | Faol (2026-10-05) |
| 13 | Tekshiruvga yuborish | Dasturchi, PM, Boshliq | "Nima qildingiz?" izohi (majburiy) va fayl biriktirish; Yuborish/Bekor qilish. **Vazifa ko'rish (6) modali ustida alohida modal sifatida ochiladi** — "modal ustida modal yo'q" qoidasidan foydalanuvchi so'rovi bilan qilingan yagona istisno (`shared/ui/Modal.tsx`ga eng tepadagi dialog aniqlanadigan umumiy mexanizm qo'shildi, boshqa modallar bitta-bittadan ochilishda davom etadi) | ichki holat (`panel === "submit"`, parametr yo'q) | Faol (2026-10-05) |

> Yon panellar (drawer) butunlay taqiqlangan, faqat modal va sahifalardan foydalaniladi.
> "Modal ustida modal yo'q" qoidasi barcha boshqa joyda amal qiladi — yuqoridagi 13-modal yagona istisno.

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
| 2026-10-05 | tasks | 0 (yangi flow emas, flow 7 kengaydi) | Menejer ijrochi bo'lmay "Tekshiruvga yuborish" bossa ijrochi tasdig'i so'raladi — loyihani yakunlash tasdig'i (flow 5b) bilan bir xil naqsh: mavjud Bildirishnomalar modalidagi Ha/Yo'q tugmasi qayta ishlatildi, yangi modal ochilmadi. tasks bo'limida flow soni 3 (limit ichida). |
| 2026-10-05 | tasks | 0 (yangi flow emas) | "Tekshiruvga yuborish" paneli (flow 7 ichida) pastki panel o'rniga alohida modal (13) qilindi — foydalanuvchi aniq so'radi: vazifa oynasi ustida ochiladi. Bu "modal ustida modal yo'q" qoidasidan maxsus ruxsat etilgan yagona istisno; "Qaytarish" (rad etish) paneli o'zgarmadi, hamon pastki panelda. Modallar 12 dan 13 ga oshdi. |
