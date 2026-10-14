# tasks/ — vazifalarni rejalashtirish va kuzatish

Maqsad: sessiya tugasa ham ish yo'qolmasin; yangi sessiya (yoki boshqa agent) `tasks/CURRENT.md` dan davom ettirsin.

## Tuzilma

| Joy | Nima | Kim yangilaydi |
|---|---|---|
| `CURRENT.md` | Hozirgi ish: holat, branch, keyingi qadam, bloklovchilar | Har sessiya boshi/oxiri |
| `backlog.md` | Navbatdagi va ochiq ishlar, har biri `B-NNN` raqamli | Yangi ish/topilma paydo bo'lganda |
| `active/NNN-slug.md` | Bajarilayotgan vazifa rejasi (`TEMPLATE.md` dan) | PLAN bosqichida yaratiladi |
| `done/NNN-slug.md` | Tugagan vazifa (active dan ko'chiriladi) + natija | DOCUMENT bosqichida |
| `sessions/YYYY-MM-DD.md` | Sessiya xulosasi: nima bajarildi, nima qoldi, keyingi qadam | Sessiya oxirida |

## Hayot sikli

1. **Backlog** → foydalanuvchi tanlaydi (yoki aytadi) → `B-NNN` bo'yicha `active/NNN-slug.md` ochiladi (ANALYZE + PLAN).
2. Katta/noaniq ishda reja foydalanuvchiga ko'rsatiladi va **tasdiq kutiladi** (`CLAUDE.md` §7).
3. IMPLEMENT → TEST (`scripts/verify.ps1`) → REVIEW: fayl ichidagi "Holat" va "Tekshiruv natijasi" yangilanib turadi.
4. DOCUMENT: tegishli `docs/` yangilanadi, fayl `done/` ga ko'chadi, `CURRENT.md` va `sessions/` yoziladi.

## Qoidalar

- Vazifa raqami `NNN` — `active/` va `done/` bo'ylab ketma-ket (001, 002…). Backlog raqami `B-NNN`.
- "Tugadi" faqat `verify.ps1` hamma qadami o'tgandan keyin yoziladi. O'tmagan/ishga tushirilmagan narsa shunday deb aniq yoziladi.
- Maxfiy qiymat (token, parol, kalit) hech qaysi faylga yozilmaydi.
- Foydalanuvchi aytmagan ish backlogga **taklif** sifatida yoziladi, bajarilmaydi (`CLAUDE.md` §0.1).
- `sessions/` yozuvi qisqa (≤ 40 qator): kontekstni tejash uchun.
