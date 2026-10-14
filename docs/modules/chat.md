# Modul: chat

**Vazifasi:** foydalanuvchilar o'rtasida xabar almashish.

**Fayllar:** `models.py` (`ChatMessage`), `services.py` (validatsiya, suhbatlar), `serializers.py`, `api.py`.

## API
`ChatViewSet` (`chat/`): `people`, `conversations`, `messages`, `send` — `../api.md`. Hammasi `IsAuthenticated`.

## Muhim qoidalar
- Suhbatda oxirgi 200 xabar; brauzer ham 200 tasini saqlaydi.
- Polling faqat oxirgi xabardan keyingi yangilarni oladi; yangi bo'lmasa javob `[]` va bazaga yozuv yo'q. Frontend adaptive polling qiladi, yashirin tabda to'xtaydi (`ARCHITECTURE.md` §3.1).
- Rolsiz akkaunt suhbatda chiqmaydi.

## Bog'liqlik
`accounts`, `core`.

## Testlar
`apps/chat/tests/test_api.py`.
