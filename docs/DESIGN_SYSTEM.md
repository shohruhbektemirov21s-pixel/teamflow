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
| `--bg` | `#f3f6f5` | `#0f1614` | Sahifa asosi foni |
| `--surface` | `#ffffff` | `#151e1b` | Kartalar, modallar, yon panel |
| `--surface-2` | `#f7f9f8` | `#1a2521` | Ikkinchi darajali zamin (jadval sarlavhasi, ustunlar) |
| `--surface-hover` | `#edf2f0` | `#22302b` | Hover effekti |
| `--border` | `#dde5e2` | `#2a3934` | Odatiy ajratuvchi chiziqlar |
| `--border-strong`| `#c7d3cf` | `#3b4c46` | Input va kartalarning kuchli chegaralari |
| `--text` | `#17211e` | `#edf4f1` | Asosiy o'qiluvchi matn |
| `--text-2` | `#43514c` | `#bdcac5` | Ikkinchi darajali matn |
| `--muted` | `#64736e` | `#91a19b` | Yordamchi, izoh va sanalar |

### 2.2. Brend va Asosiy Harakat (Brand & Primary)
| Token | Light Qiymat | Dark Qiymat | Ishlatilish Joyi |
|---|---|---|---|
| `--primary` | `#176b5b` (sokin teal) | `#7dcebb` | Asosiy harakat tugmalari, faol tablar |
| `--primary-hover`| `#11584b` | `#9bddcd` | Asosiy tugma hover holati |
| `--primary-soft` | `#e4f1ed` | `#19342d` | Tanlangan element foni, yumshoq nishonlar |
| `--primary-text` | `#ffffff` | `#ffffff` | Asosiy tugma ichidagi matn |
| `--focus` | `primary` rangining 45% aralashmasi | `primary` rangining 45% aralashmasi | Fokus halqasi (3px) |

### 2.3. Semantik / Holat Ranglari (Status Tones)
Har bir holat o'zining asosiy rangi va yumshoq foniga ega:
- **Xavf / Kechikish (`danger`):** Matn `--danger` (`#b42318`), Fon `--danger-soft` (`#faecea`).
- **Muvaffaqiyat / Yakunlangan (`success`):** Matn `--success` (`#18734b`), Fon `--success-soft` (`#e6f3ec`).
- **Ogohlantirish / Jarayonda (`warning`):** Matn `--warning` (`#99570a`), Fon `--warning-soft` (`#f8f0e3`).
- **Ma'lumot / Yuborilgan (`info`):** Matn `--info` (`#25687d`), Fon `--info-soft` (`#e6f1f4`).
- **Binafsharang / Reja (`violet`):** Matn `--violet` (`#655a8c`), Fon `--violet-soft` (`#eeebf5`).
- **Neytral / Arxiv (`slate`):** Matn `--slate` (`#53645e`), Fon `--slate-soft` (`#ebf0ee`).

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
| `--radius-sm` | `9px` | Standart tugmalar (`.btn`), inputlar (`.input`, `.select`), teglar |
| `--radius-md` (`--radius`) | `14px` | Kartalar (`.card`), panellar, bildirishnoma toastlari |
| `--radius-lg` | `18px` | Modallar (`.modal`), bo'sh holat ikonkasi |
| `--radius-full` | `9999px` | Yumaloq nishonlar (`.badge`), hisoblagichlar (`.count-pill`), avatarlar |

---

## 5. Komponentlar Uslublari (Component Styles)

### 5.1. Tugmalar (`Button`)
Balandliklar:
- `sm`: **32px** (padding: 0 12px, shrift: 13px) — kichik ro'yxat va jadval amallari
- Standart: **40px** (padding: 0 16px, shrift: 14px) — asosiy interfeys harakatlari
- `lg`: **48px** (padding: 0 24px, shrift: 15px) — bosh sahifa, buyurtma yaratish kabi asosiy qadamlar

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
  - Burchak: `var(--radius)` (14px)
  - Soya: `var(--shadow)`
  - Ichki padding: `20px` (`.card-pad`) yoki tuzilmali (`.card-head`, `.card-toolbar`, `.card-body`)
- `.clickable` klassi qo'shilganda: sichqoncha ustiga kelganda border `--border-strong` ga o'zgaradi va silliq ko'tarilish soyasi hosil bo'ladi.

### 5.3. Forma Maydonlari (`Field`, `Input`, `Select`, `Textarea`)
- Balandlik: Standart **40px** (textarea minimal 96px).
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
- Modal tanasi: `var(--surface)`, burchaklari `18px`, soyasi `var(--shadow-lg)`.
- Sarlavha paneli (`.modal-head`): 18px 18px 18px 24px padding, pastki chiziq.
- Tana (`.modal-body`): 26px 24px padding, avtomatik aylanuvchi (scrollable).
- Pastki amal paneli (`.modal-foot`): 16px 24px padding, tepa chiziq, fon `--surface-2`.
- Modal ustida boshqa modal ochilmaydi — barcha ichki amallar ichki panelda yoki orqaga qaytish bilan almashadi.

---

## 6. Responsive va accessibility

- 860px dan kichik ekranlarda yon menyu drawer sifatida ochiladi; ochiq menyu nomlangan yopish tugmasi va `Escape` bilan yopiladi.
- Har bir asosiy shell’da skip-link va `main` landmark mavjud; tema va menyu holatlari `aria-pressed`/`aria-expanded` bilan e'lon qilinadi.
- Mobil boshqaruv elementlari kamida 44px balandlikda bo'ladi, matn va fon kontrasti AA darajasidan pastga tushirilmaydi.
- `prefers-reduced-motion: reduce` yoqilganda animatsiyalar va o'tishlar deyarli o'chiriladi.

---

## 7. Ma'lumotlarning Doimiyligi (Database Driven)

- Interfeysdagi barcha ma'lumotlar (vazifalar, buyurtmalar, loyihalar, foydalanuvchilar, izohlar, statistika) to'liq Django backend orqali SQLite bazasidan yuklanadi.
- Frontendda hech qanday soxta (mock) yoki qattiq kodlangan (hardcoded) ro'yxat qolmagan.
- Yangilanishlar avtomatik `React Query` orqali keshlanadi va o'zgarish sodir bo'lganda (`useRefresh()`) yangilanadi.

---

## 8. Versiya va Qaytarish Qobiliyati (Rollback Capability)

- Dizayn tizimi va kod bazasi har bir muhim bosqichda git teglari (`v1.0-baseline` va boshqalar) bilan saqlanadi.
- Har qanday kutilmagan buzilishda avvalgi barqaror holatga 1 buyruq bilan qaytish kafolatlanadi.
