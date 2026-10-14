# 0002 — App qatlamlari va yagona `workflow.py`

- Holat: Qabul qilingan
- Sana: 2026-09-28 (hujjatlashtirilgan 2026-10-14)
- Manba: `docs/ARCHITECTURE.md` §3, §5; `CLAUDE.md` §10

## Kontekst
Eski loyiha auditida "qatlam buzilishi" topilgan edi: biznes qoida API, serializer va frontendda takrorlangan.

## Qaror
Har app: `models` → `workflow` (sof funksiyalar) → `services` (tranzaksiyali biznes amallar) → `permissions` → `serializers` → `api` (yupqa). Holat o'tishlari **faqat** `apps/*/workflow.py` jadvallarida, umumiy tekshiruv `core/workflow.py`. Pastdagi app yuqoridagini import qilmaydi: `core ← accounts ← orders ← projects ← tasks`; `panel` va `portfolio` eng yuqori qatlam.

## Nima uchun
Bitta joyda bitta qoida — o'zgartirish bitta joyda, test oson, tsiklik bog'liqlik yo'q.

## Oqibatlar
Yangi holat o'tishi = jadvalga qator + test. `api.py` ga biznes mantiq yozilmaydi. Ma'lum istisno: `accounts/serializers.py` ichida `portfolio`/`tasks` lazy import (profil statistikasi) — `docs/modules/accounts.md`.
