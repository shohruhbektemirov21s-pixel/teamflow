# Modul: portfolio

**Vazifasi:** dasturchi portfoliosi — loyihalar (avtomatik va qo'lda), video, havola, muqova va texnologiyalar, baho (1–5 yulduz) va sharh, kuzatish, reyting.

**Fayllar:** `models.py`, `permissions.py`, `services.py`, `stats.py` (reyting, sonlar, tajriba — subquery), `files.py` (video validatsiyasi, Range bilan berish), `signals.py` (`ProjectMember` → portfolio materializatsiyasi, fayl o'chirilishi), `technologies.py`, `serializers.py`, `api.py`, `admin.py`.

## Modellar
`PortfolioItem` (egasi + loyiha uchun unikal), `PortfolioVideo`, `PortfolioReview` (`unique(item, author)`, yulduz 1–5 CHECK), `Follow` (o'zini kuzatmaydi — CHECK).

## Ruxsat
`can_edit_item`, `can_review_item`, `can_follow` (`permissions.py`). Portfolio hamma rolga ochiq; baholash qoidalari `README.md` "Ochiq savollar" da.

## API
`portfolio/*` — `../api.md`. Ro'yxat: `?following=1&specialty=&sort=followers|projects|reviews`.

## Muhim qoidalar
- Standart reyting birinchi sahifasi 60 soniya keshlanadi; kesh tranzaksiya tasdiqlangach tozalanadi. Kuzatish holati (viewer'ga bog'liq) alohida olinadi.
- Video: MP4/WebM/MOV; chegaralar `config/settings.py` da: `PORTFOLIO_VIDEO_MAX_MB=100`, `PORTFOLIO_VIDEOS_PER_ITEM=5`. Muqova: `PORTFOLIO_COVER_MAX_MB=5`, `PORTFOLIO_COVER_MAX_PX=1600`, Pillow bilan tekshiriladi.
- Foydalanuvchi (oddiy `user` roli) uchun bosh sahifa — shu API (`UserDashboard`); yangi flow/modal ochilmaydi.
- Frontend: bitta "Portfolio" modali ichida ko'rinishlar almashadi (modal ustida modal yo'q).

## Bog'liqlik
`accounts`, `core`, `projects`, `tasks` — eng yuqori domen qatlami, uni hech kim import qilmaydi (`accounts/serializers.py` dagi lazy import bundan istisno — `accounts.md`ga qarang).

## Testlar
`apps/portfolio/tests/`: `test_api`, `test_scale_cache`.
