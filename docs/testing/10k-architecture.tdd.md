# 10k arxitekturasi — TDD qaydi

## Maqsad

Portfolio reytingi, notification unread hisoblari va chat polling bir vaqtda ko'p foydalanuvchi ishlatganda PostgreSQL/Redis va brauzer resursini keraksiz takroriy ish bilan band qilmasligi kerak. Portfolio GET o'qish paytida yozuv bajarmasligi shart.

## RED bosqichi

- `backend\.venv\Scripts\python.exe manage.py test apps.notifications.tests.test_cache apps.portfolio.tests.test_scale_cache` — yangi cache/index/membership-signal API'lari mavjud emasligi sababli yiqildi; portfolio testlarida cache, index va materializatsiya uchun kutilgan failurelar ko'rindi.
- `npm exec vitest run src/features/chat/polling.test.ts` — yangi `polling` moduli hali mavjud emasligi sababli yiqildi.

## GREEN bosqichi

- `backend\.venv\Scripts\python.exe manage.py test apps.notifications.tests.test_cache apps.portfolio.tests.test_scale_cache` — 6 test o'tdi.
- `backend\.venv\Scripts\python.exe manage.py test` — 298 test o'tdi, 2 ta skip.
- `npm exec vitest run src/features/chat/polling.test.ts` — 1 test o'tdi.
- `npm exec tsc -b --noEmit` — muvaffaqiyatli.
- `npm exec vitest run` va `npm run build` — yakuniy frontend tekshiruvlari.
- `backend\.venv\Scripts\python.exe manage.py makemigrations --check --dry-run` — yangi migration qolmadi.
- `backend\.venv\Scripts\python.exe manage.py check` — muammo topilmadi.

## Verifikatsiya qilingan xatti-harakatlar

1. `ProjectMember` yaratilishi `PortfolioItem`ni signal orqali yaratadi; portfolio detail GET SQL INSERT bajarmaydi.
2. Standart ranking qayta so'ralganda Redis cache ishlatiladi; viewerning follow holati alohida query bilan to'g'ri qoladi.
3. Review, follow va item o'zgarishlari ranking cache'ini invalidatsiya qiladi.
4. Unread count cache ikkinchi o'qishda DB queryni o'tkazib yuboradi; notify/read commitidan keyin invalidatsiya qilinadi.
5. Chat polling yangi xabar bo'lmaganda 5, 10, 20, 40, 60 soniyagacha ortadi va yangi xabarda 5 soniyaga qaytadi.

## Qamrov chegarasi

Ushbu qayd regressiya testlarini hujjatlashtiradi; coverage foizi bu ishda alohida o'lchanmadi. 10k capacity harness hali joriy portfolio, login burst, upload, browser polling va uzoq soak bilan qayta ishlatilishi kerak. Eski hisobotdagi raqamlar shu ish uchun avtomatik kafolat hisoblanmaydi.
