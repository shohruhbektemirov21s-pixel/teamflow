# TeamFlow — Design System

Ushbu hujjat TeamFlow loyihasining yagona va markazlashtirilgan **Dizayn Tizimi (Design System)** qoidalarini belgilaydi. Barcha mavjud va yangi sahifalar, modallar hamda komponentlar qat'iy ravishda ushbu tizimga bo'ysunadi.

---

## 1. Asosiy Prinsiplar

1. **Yagona Manba (Single Source of Truth):**
   - Barcha ranglar, bo'shliqlar, burchak radiuslari va soyalar `src/shared/styles.css` dagi CSS o'zgaruvchilari orqali boshqariladi.
   - Komponentlarda ixtiyoriy (ad-hoc) ranglar yoki kutilmagan piksellar yozilmaydi.
2. **Bir xil komponentlar (Consistency):**
   - Bir sahifadagi tugma, karta, maydon va belgilar boshqa sahifada aynan bir xil ko'rinish va o'lchamga ega bo'ladi.
   - Barcha asosiy elementlar `src/shared/ui/` kutubxonasidan olinadi (`Button`, `Card`, `Badge`, `Field`, `Modal`, `Avatar`, `Empty`, `Due`, `Segmented`).
3. **Auditoriya (18–40 yosh):**
   - Ortiqcha bezaklar va tushunarsiz texnik atamalardan xoli, zamonaviy, tezkor, qulay va intuitiv interfeys.
   - Har bir ekranda bitta aniq asosiy amal (Primary action).
4. **Moslashuvchanlik va Qulaylik:**
   - 8px grid tizimi.
   - Yorug' (Light) va Qorong'i (Dark) rejimlarni to'liq qo'llab-quvvatlash.
   - Klaviatura boshqaruvi (`Tab`, `Esc`, `Enter`, `Space`) va a11y standartlari.

---

## 2. Ranglar Palitrasi (Color Palette)

### 2.1. Neytral Yuzalar va Matnlar (Surfaces & Typography)
| Token | Light Qiymat | Dark Qiymat | Ishlatilish Joyi |
|---|---|---|---|
| `--bg` | `#f5f6fa` | `#0f1117` | Sahifa asosi foni |
| `--surface` | `#ffffff` | `#171a23` | Kartalar, modallar, yon panel |
| `--surface-2` | `#f9fafb` | `#1c202b` | Ikkinchi darajali zamin (jadval sarlavhasi, ustunlar) |
| `--surface-hover` | `#f3f4f8` | `#222734` | Hover effekti |
| `--border` | `#e6e8ef` | `#2a2f3d` | Odatiy ajratuvchi chiziqlar |
| `--border-strong`| `#d4d7e1` | `#363c4d` | Input va kartalarning kuchli chegaralari |
| `--text` | `#151826` | `#eceef5` | Asosiy o'qiluvchi matn |
| `--text-2` | `#4b5165` | `#b8bdcc` | Ikkinchi darajali matn |
| `--muted` | `#7a8094` | `#868c9e` | Yordamchi, izoh va sanalar |

### 2.2. Brend va Asosiy Harakat (Brand & Primary)
| Token | Light Qiymat | Dark Qiymat | Ishlatilish Joyi |
|---|---|---|---|
| `--primary` | `#4f46e5` (Indigo) | `#7c79ff` | Asosiy harakat tugmalari, faol tablar |
| `--primary-hover`| `#4338ca` | `#948fff` | Asosiy tugma hover holati |
| `--primary-soft` | `#eef0ff` | `#262a4a` | Tanlangan element foni, yumshoq nishonlar |
| `--primary-text` | `#ffffff` | `#ffffff` | Asosiy tugma ichidagi matn |
| `--focus` | `rgba(79, 70, 229, 0.28)` | `rgba(124, 121, 255, 0.35)` | Fokus halqasi (3px) |

### 2.3. Semantik / Holat Ranglari (Status Tones)
Har bir holat o'zining asosiy rangi va yumshoq foniga ega:
- **Xavf / Kechikish (`danger`):** Matn `--danger` (`#dc2626`), Fon `--danger-soft` (`#fdecec`).
- **Muvaffaqiyat / Yakunlangan (`success`):** Matn `--success` (`#15803d`), Fon `--success-soft` (`#e7f6ec`).
- **Ogohlantirish / Jarayonda (`warning`):** Matn `--warning` (`#b45309`), Fon `--warning-soft` (`#fdf3e2`).
- **Ma'lumot / Yuborilgan (`info`):** Matn `--info` (`#0369a1`), Fon `--info-soft` (`#e5f2fb`).
- **Binafsharang / Reja (`violet`):** Matn `--violet` (`#7c3aed`), Fon `--violet-soft` (`#f1ebff`).
- **Neytral / Arxiv (`slate`):** Matn `--slate` (`#475569`), Fon `--slate-soft` (`#eef1f5`).

---

## 3. Bo'shliqlar Tizimi (Spacing Scale)

TeamFlow 4px va 8px qadamli bo'shliqlar setkasidan foydalanadi:

| Token | O'lcham | Ishlatilishi |
|---|---|---|
| `--space-1` | `4px` | Mikroskopik bo'shliq, chips ichki bo'shliqlari |
| `--space-2` | `8px` | Tugma va belgi ichidagi ikonka-matn orasi, `.row` elementi |
| `--space-3` | `12px` | Forma maydonlari orasidagi standart oraliq (`.stack`), grid oraliqlari |
| `--space-4` | `16px` | Karta ichki bo'shlig'i (`.card-pad`), jadval kataklari |
| `--space-5` | `20px` | Sahifa qismlari oralig'i, modal asosiy tanasi paddingi |
| `--space-6` | `24px` | Sahifa tashqi paddingi (`.page`), modal sarlavhasi |
| `--space-8` | `32px` | Bo'limlararo katta ajratuvchi bo'shliq |

---

## 4. Burchak Radiusi (Border Radius)

| Token | O'lcham | Ishlatilishi |
|---|---|---|
| `--radius-xs` | `6px` | Progress barlar, kichik belgilar |
| `--radius-sm` | `8px` | Standart tugmalar (`.btn`), inputlar (`.input`, `.select`), teglar |
| `--radius-md` (`--radius`) | `12px` | Kartalar (`.card`), panellar, bildirishnoma toastlari |
| `--radius-lg` | `16px` | Modallar (`.modal`), bo'sh holat ikonkasi |
| `--radius-full` | `9999px` | Yumaloq nishonlar (`.badge`), hisoblagichlar (`.count-pill`), avatarlar |

---

## 5. Komponentlar Uslublari (Component Styles)

### 5.1. Tugmalar (`Button`)
Balandliklar:
- `sm`: **30px** (padding: 0 10px, shrift: 13px) — kichik ro'yxat va jadval amallari
- Standart: **36px** (padding: 0 14px, shrift: 14px) — asosiy interfeys harakatlari
- `lg`: **44px** (padding: 0 20px, shrift: 15px) — bosh sahifa, buyurtma yaratish kabi asosiy qadamlar

Variantlar:
- `primary`: `--primary` fon, oq matn, chegara yo'q/bir xil.
- `default`: `--surface` fon, `--border-strong` chegara, `--text` rang. Hoverda `--surface-hover`.
- `ghost`: Fon shaffof, chegarasiz. Hoverda `--surface-hover`.
- `danger`: `--danger-soft` fon, `--danger` rang va chegara.
- `success`: `--success` fon, oq matn.

### 5.2. Kartalar (`Card`)
- Barcha sahifalardagi kartalar bir xil tuzilishda bo'ladi:
  - Fon: `var(--surface)`
  - Chegara: `1px solid var(--border)`
  - Burchak: `var(--radius)` (12px)
  - Soya: `var(--shadow)`
  - Ichki padding: `16px` (`.card-pad`) yoki tuzilmali (`.card-head`, `.card-toolbar`, `.card-body`)
- `.clickable` klassi qo'shilganda: sichqoncha ustiga kelganda border `--border-strong` ga o'zgaradi va silliq ko'tarilish soyasi hosil bo'ladi.

### 5.3. Forma Maydonlari (`Field`, `Input`, `Select`, `Textarea`)
- Balandlik: Standart **38px** (textarea minimal 88px).
- Chegara: `1px solid var(--border-strong)`.
- Fokusda: `border-color: var(--primary)` va `box-shadow: var(--focus)`.
- Xatolikda (`aria-invalid="true"`): `border-color: var(--danger)`.
- Label har doim yuqorida (`font-weight: 600`), majburiy bo'lsa qizil yulduzcha (`*`).
- Xato matni har doim maydon ostida qizil rangda chiqadi.

### 5.4. Belgilar (`Badge` va `StatusBadge`)
- Balandlik: **24px**, padding: `0 9px`, radius: `9999px`.
- Shrift: `12px`, `font-weight: 600`.
- Har bir holat nishoni semantik rang toni (`tone-*`) bilan beriladi va chap tomonida 7px lik rangli nuqta (`.dot`) bo'ladi.
- Matnlar to'g'ridan-to'g'ri backend metadatasidan olinadi (`useMeta().label(...)`).

### 5.5. Modallar (`Modal`)
- Yon panel (drawer) ishlatilmaydi — faqat modal (CLAUDE.md, 13-bo'lim).
- Modal zamin: `var(--overlay)` qora yarim shaffof parda.
- Modal tanasi: `var(--surface)`, burchaklari `16px`, soyasi `var(--shadow-lg)`.
- Sarlavha paneli (`.modal-head`): 16px 20px padding, pastki chiziq.
- Tana (`.modal-body`): 20px padding, avtomatik aylanuvchi (scrollable).
- Pastki amal paneli (`.modal-foot`): 14px 20px padding, tepa chiziq, fon `--surface-2`.
- Modal ustida boshqa modal ochilmaydi — barcha ichki amallar ichki panelda yoki orqaga qaytish bilan almashadi.

---

## 6. Ma'lumotlarning Doimiyligi (Database Driven)

- Interfeysdagi barcha ma'lumotlar (vazifalar, buyurtmalar, loyihalar, foydalanuvchilar, izohlar, statistika) to'liq Django backend orqali SQLite bazasidan yuklanadi.
- Frontendda hech qanday soxta (mock) yoki qattiq kodlangan (hardcoded) ro'yxat qolmagan.
- Yangilanishlar avtomatik `React Query` orqali keshlanadi va o'zgarish sodir bo'lganda (`useRefresh()`) yangilanadi.

---

## 7. Versiya va Qaytarish Qobiliyati (Rollback Capability)

- Dizayn tizimi va kod bazasi har bir muhim bosqichda git teglari (`v1.0-baseline` va boshqalar) bilan saqlanadi.
- Har qanday kutilmagan buzilishda avvalgi barqaror holatga 1 buyruq bilan qaytish kafolatlanadi.
