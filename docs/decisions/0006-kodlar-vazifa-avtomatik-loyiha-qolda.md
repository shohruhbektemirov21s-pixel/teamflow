# 0006 — Kodlar: vazifa avtomatik, loyiha qo'lda

- Holat: Qabul qilingan
- Sana: 2026-10-02
- Manba: `requirements-log.md` (2026-10-02); `backend/apps/core/codes.py`

## Kontekst
Avval ikkalasi ham `TSK-12`/`PRJ-3` (bazadagi id'dan), keyin tasodifiy 9 xonali kod bo'ldi; loyiha uchun foydalanuvchi o'z raqamini kiritishni talab qildi.

## Qaror
`Task.code` — yaratilganda avtomatik tasodifiy 9 xonali, unikal (`editable=False`). `Project.code` — PM/Boshliq loyiha yaratish oynasida **qo'lda** kiritadi (majburiy, erkin matn, unikal; band bo'lsa xato). Qidiruv: loyiha raqami aniq moslik, vazifa kodi qisman (1–2 raqam ham).

## Nima uchun
Vazifa kodi ichki identifikator; loyiha raqami esa tashkilotning o'z raqamlash tizimi bilan mos bo'lishi kerak.

## Oqibatlar
`core/codes.py` `tasks`/`projects` modellarini statik import qilmaydi (`apps.get_model`) — qatlam qoidasi (ADR 0002) buzilmasin.
