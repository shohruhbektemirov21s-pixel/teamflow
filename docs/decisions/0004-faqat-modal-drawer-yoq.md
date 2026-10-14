# 0004 — Faqat modal (drawer yo'q), cheklangan istisno

- Holat: Qabul qilingan
- Sana: 2026-09-28; istisno 2026-10-06
- Manba: `CLAUDE.md` §4–5; `docs/FLOWS_MODALS.md`; `requirements-log.md`

## Kontekst
Yon panellar foydalanuvchini chalg'itgan; sahifalar gavjum bo'lgan. Auditoriya 18–40 yosh, o'qitish talab qilinmasligi kerak.

## Qaror
Ko'rish, yaratish, tahrirlash — modalda; yon panel (drawer) yo'q. Modal ustida modal yo'q, **bitta istisno**: qaror amallari ("Tekshiruvga yuborish"/"Qaytarish", "Tasdiqlash"/"Rad etish", yakunlash izohi) — asosiy oyna ustida qora fonli alohida modal (`Modal stacked`), orqa oyna `inert`. Modal manzilga yozilmaydi (holat brauzer tarixida). Bitta bo'limda 3–4 flow (istisnoda 5).

## Nima uchun
Diqqat bir joyda qoladi; flow sonini cheklash murakkablikni ushlab turadi.

## Oqibatlar
Yangi modal ochishdan oldin mavjudini kengaytirish ko'rib chiqiladi; har bir yangi flow/modal `docs/FLOWS_MODALS.md` ga yoziladi va `user-flow-check` skill ishlatiladi.
