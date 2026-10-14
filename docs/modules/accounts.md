# Modul: accounts

**Vazifasi:** foydalanuvchi, rol, mutaxassislik; ro'yxatdan o'tish, login/logout, profil, rasm, parol, xizmat safari, mas'uliyatlar.

**Fayllar:** `models.py`, `services.py`, `serializers.py`, `api.py`, `admin.py`, `management/commands/seed_demo.py`, `tests/`.

## Modellar
- `Role` (TextChoices): `boss`, `pm`, `developer`, `department`, `user` (Oddiy foydalanuvchi).
- `Specialty` — mutaxassislik (Django adminda boshqariladi).
- `User` (`AbstractUser` kengaytmasi) — `role`, `specialty`, bo'lim nomi, Telegram maydonlari, avatar. Ro'yxatdan o'tganlar `is_active=False` bilan yaratiladi; Django admin faollashtiradi. Boshliq faqat admin orqali.

## API
`auth/*`, `avatars/<id>/`, `specialties/`, `developers/`, `people/<id>/business-trip/`, `people/<id>/responsibilities/` — jadval: `../api.md`. Login va ro'yxatdan o'tishda `AuthThrottle` (anonim, 20/daq).

## Muhim qoidalar
- Rasm: JPG/PNG/WEBP, 5 MB gacha; Pillow bilan tekshiriladi, 1024px gacha kichraytirib JPEG qilinadi, EXIF o'chadi (`requirements-log.md`, 2026-09-30).
- Telegram username takrorlanmaydi.
- Rol xossalari (`is_manager`, `is_department`) ruxsat tekshiruvlarida ishlatiladi (`core/api_utils.py: IsManager/IsDepartment`).

## Bog'liqlik
`core` ga tayanadi. **Kuzatuv:** `accounts/serializers.py` (qatorlar ~124–134) ichida funksiya ichida `portfolio` va `tasks` ni import qiladi (profil statistikasi uchun) — bu `ARCHITECTURE.md` §3 dagi "pastdagi app yuqoridagini import qilmaydi" qoidasidan istisno. Yangi shunday import qo'shmang; mavjudi o'zgartirilishi alohida vazifa (`tasks/backlog.md`).

## Testlar
`apps/accounts/tests/`: `test_api`, `test_avatar`, `test_business_trip`, `test_csrf`, `test_models`, `test_profile`, `test_responsibilities`.
