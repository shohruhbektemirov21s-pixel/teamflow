# Qarorlar (ADR) va talablar logi

Ikki xil yozuv:
- **ADR** (`NNNN-qisqa-nom.md`) — texnik qaror: nima tanlandi va **nima uchun**. O'zgarmas: qaror o'zgarsa, eski ADR holati "Almashtirildi (NNNN)" bo'ladi, yangisi yoziladi.
- **`requirements-log.md`** — foydalanuvchi talablari va sessiya qarorlari xronologiyasi (oxiriga qo'shiladi, hajmi katta — `Grep` bilan qidiring).

## ADR indeksi

| № | Qaror | Holat |
|---|---|---|
| [0001](0001-sessiya-va-csrf-autentifikatsiya.md) | Sessiya + CSRF autentifikatsiya | Qabul qilingan |
| [0002](0002-qatlamlar-va-yagona-workflow.md) | App qatlamlari va yagona `workflow.py` | Qabul qilingan |
| [0003](0003-sqlite-mahalliy-postgresql-production.md) | Mahalliy SQLite, production PostgreSQL + Redis | Qabul qilingan |
| [0004](0004-faqat-modal-drawer-yoq.md) | Faqat modal (drawer yo'q), cheklangan istisno | Qabul qilingan |
| [0005](0005-loyiha-yakunlash-ikki-bosqichli-tasdiq.md) | Loyiha yakunlash: dasturchilar → PM → boshqarma | Qabul qilingan |
| [0006](0006-kodlar-vazifa-avtomatik-loyiha-qolda.md) | Kodlar: vazifa avtomatik, loyiha qo'lda | Qabul qilingan |
| [0007](0007-himoyalangan-fayllar-va-telegram-oncommit.md) | Fayllar faqat ruxsat bilan; Telegram `on_commit`/outbox | Qabul qilingan |
| [0008](0008-ai-development-workflow.md) | AI development workflow (CLAUDE.md, docs/, tasks/) | Qabul qilingan |

## Yangi ADR shabloni

```markdown
# NNNN — Sarlavha

- Holat: Taklif | Qabul qilingan | Almashtirildi (NNNN)
- Sana: YYYY-MM-DD
- Manba: (hujjat, talab, PR)

## Kontekst
Qanday muammo yoki cheklov bor edi.

## Qaror
Nima tanlandi.

## Nima uchun
Sabablar va rad etilgan variantlar.

## Oqibatlar
Yaxshi tomoni, qiyinchiligi, qaysi kod/hujjatga ta'sir qiladi.
```
