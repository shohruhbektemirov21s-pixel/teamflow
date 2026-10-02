# Vazifa arxivi va sahifalash: TDD dalili

Manba: foydalanuvchining ikki muammoni tuzatish so'rovi. Reja fayli berilmagan.

## Kafolatlar

| Holat | RED dalili | GREEN dalili |
|---|---|---|
| Vazifa o'chirilganda ish jurnali, topshirish va izoh saqlanadi; faol ro'yxatdan chiqadi | `test_delete_archives_task_without_losing_work_history`: `Task.DoesNotExist` | Shu test o'tdi; loyiha progressi nol, tarix havolasi saqlangan, arxivdagi tahrir va yangi izoh bloklangan |
| Vazifalar ro'yxatida ikkinchi sahifa ochiladi | `TasksPage.test.tsx`: “Keyingi” tugmasi topilmadi | Test `/tasks/?page=2` so'rovi va ikkinchi sahifa matnini tasdiqladi |
| Loyiha tanlash barcha sahifalarni oladi | `queries.test.tsx`: `[1]` natija `[1, 51]`ga teng emas | Test ikkala sahifa loyiha IDlarini tasdiqladi |
| Bildirishnoma, taklif va loyiha tarixi sahifalanadi | Uchta UI testi: “Keyingi” tugmasi topilmadi | Shu testlar ikkinchi sahifa mazmunini ko'rsatdi |
| Arxivlangan vazifa izohlari faqat o'qiladi | `TaskModal.test.tsx`: izoh yozish formasi hali ko'rinardi | Arxiv belgisi bor, izoh formasi yo'q; avvalgi izohlar API orqali o'qiladi |

Tekshiruv: `python manage.py test` (169 test o'tdi), `npx vitest run` (57 test o'tdi), `npm run typecheck` (o'tdi), `python manage.py makemigrations --check --dry-run` (o'zgarish yo'q).

Coverage foizi o'lchanmadi: Python `coverage` paketi va frontend coverage plagini loyihada o'rnatilmagan. Regressiya testlari aniqlangan xatolarning API va UI oqimlarini tekshiradi; browser E2E bu ishda bajarilmadi.

RED/GREEN natijalari shu hujjatda saqlandi. Git checkpoint commitlari qilinmadi; o'zgarishlar foydalanuvchi ko'rib chiqishi uchun ishchi katalogda qoldirildi.
