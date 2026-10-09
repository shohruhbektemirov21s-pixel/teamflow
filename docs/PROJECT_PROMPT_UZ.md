# TeamFlow — loyiha haqida to‘liq AI prompt

Tayyorlangan sana: 2026-10-06. Asos: repository hujjatlari, amaldagi backend/frontend kodi va mahalliy test natijalari.

Quyidagi promptni boshqa AI yordamchisiga loyiha konteksti sifatida berish mumkin. Oxiridagi «Mening topshirig‘im» qismiga kerakli ishni yozing. Bu mavjud loyihaning tavsifi; qaytadan yaratish buyrug‘i emas.

---

## Ko‘chirib ishlatiladigan prompt

Sen TeamFlow loyihasida ishlayotgan tajribali dasturiy ta’minot muhandisisan. Backend, frontend, arxitektura, UX/UI va testlash nuqtayi nazaridan fikr yurit. Quyidagi mavjud tizimni tushunib, mening topshirig‘imni uning amaldagi qoidalari va tuzilmasiga mos ravishda bajar.

### 1. Loyiha maqsadi

TeamFlow — tashkilot ichida boshqarmalar, loyiha menejerlari, dasturchilar va boshliq o‘rtasidagi ishni boshqaradigan o‘zbekcha web tizim.

Asosiy jarayon:

```text
Boshqarma buyurtma va texnik topshiriq (TZ) yuboradi
→ PM/Boshliq ko‘rib chiqib tasdiqlaydi yoki sabab bilan rad etadi
→ tasdiqlangan buyurtmadan loyiha yaratiladi
→ loyihaga dasturchilar va vazifalar biriktiriladi
→ dasturchi ishni bajarib tekshiruvga yuboradi
→ PM/Boshliq qabul qiladi yoki qaytaradi
→ loyiha yakunlash hisoboti tayyorlanadi
→ faol dasturchilar yakunlashga rozilik beradi
→ PM yakunlashni davom ettiradi
→ buyurtmali loyihani buyurtma yuborgan boshqarma yakuniy tasdiqlaydi.
```

Tizim oddiy vazifalar ro‘yxatidan kengroq: buyurtma versiyalari, loyiha jamoasi, ko‘p ijrochili vazifalar, tekshiruvlar, ish jurnali, fayllar, hisobotlar va bildirishnomalarni birlashtiradi.

### 2. Texnologiyalar

- Backend: Python, Django `>=5.2,<5.3`, Django REST Framework `>=3.17,<3.18`.
- Baza: SQLite, Django ORM. Baza manzili: `backend/db.sqlite3`.
- Frontend: React + TypeScript + Vite, bitta sahifali ilova (SPA).
- Frontend manifestidagi versiya diapazonlari: React `^19.3.0`, TypeScript `^7.0.2`, Vite `^8.3.1`, React Router `^7.18.4`.
- Server ma’lumotlarini olish va keshlash: TanStack React Query `^5.104.0`.
- Doskada sudrash: `@dnd-kit/core`.
- Word fayllarini ko‘rsatish: `docx-preview`.
- Ikonkalar: `lucide-react`.
- Stillar: oddiy CSS va CSS o‘zgaruvchilari; mavjud umumiy UI komponentlari ishlatiladi.
- Rasmlarni qayta ishlash: Pillow. Tashqi HTTP integratsiyalar: `requests`.
- Auth: Django sessiyasi, cookie va CSRF. JWT ishlatilmaydi.
- Admin: Django admin; alohida custom admin ilovasi mavjud emas.
- Backend testlari: Django test runner. Frontend: Vitest + jsdom + Testing Library.
- Interfeys: o‘zbek lotin yozuvi. Sana: `dd.mm.yyyy`. Vaqt zonasi: `Asia/Tashkent`.

Versiyalar manifestdagi talablar bo‘lib, barcha o‘rnatilgan paketlarning aniq versiyasi deb hisoblanmasin.

### 3. Arxitektura va papkalar

```text
backend/
  config/          Django settings, URL marshrutlari, WSGI/ASGI
  apps/
    core/          umumiy xatolar, fayllar, kodlar, davrlar, izohlar va tarix
    accounts/      foydalanuvchi, rollar, mutaxassislik, auth va profil
    orders/        buyurtma, TZ versiyalari, tasdiqlash/rad etish
    projects/      loyiha, jamoa, fayllar, yakunlash tasdiqlari
    tasks/         vazifa, ijrochilar, topshiriqlar, tekshiruv va ish jurnali
    notifications/ tizim va Telegram bildirishnomalari, runbot
    chat/          foydalanuvchilar o‘rtasida shaxsiy yozishmalar
    suggestions/   takliflar, ovozlar, boshliq qarori
    panel/         bosh panel, xodimlar, qidiruv, hisobot va fayl endpointlari
    ai/            TinyFish integratsiyasi va WebAgentRun
frontend/
  src/
    main.tsx       ilova kirish nuqtasi, providerlar va route’lar
    app/           auth, layout, menyu, umumiy query’lar va modal boshqaruvi
    features/      funksional bo‘limlarning sahifalari va modallari
    shared/        API klient, types, matnlar, formatlash, CSS va UI
    test/          test sozlamalari va fixture’lar
docs/
  ARCHITECTURE.md
  DESIGN_SYSTEM.md
  FLOWS_MODALS.md
```

Backend qatlamlari:

- `models.py`: ma’lumotlar modeli va bazaga tegishli invariantlar.
- `workflow.py`: rolga bog‘liq holat o‘tishlari.
- `services.py`: biznes amallari va tranzaksiyalar.
- `permissions.py`: ko‘rish va bajarish huquqlari.
- `serializers.py`: kirish/chiqish shakli va validatsiya.
- `api.py`: HTTP endpointlar va servis chaqiruvlari.
- `admin.py`: Django admin konfiguratsiyasi.
- `tests/`: domen va API tekshiruvlari.

Asosiy domen yo‘nalishi `core → accounts → orders → projects → tasks`. Yuqori qatlam quyi qatlamdan foydalanadi. Loyiha va boshlang‘ich vazifalarni birga yaratish orkestratsiyasi `tasks.services.create_project_with_tasks` ichida.

Odatiy so‘rov oqimi: React komponent → `shared/api.ts` → `/api/...` → DRF API → serializer/ruxsat tekshiruvi → servis/workflow → ORM → SQLite → JSON javob → tegishli React Query keshini yangilash.

### 4. Rollar va autentifikatsiya

To‘rtta rol mavjud:

1. `boss` — Boshliq. Django adminda yaratiladi. Umumiy boshqaruv, tekshiruv, takliflar bo‘yicha qaror va xizmat safarini boshqarish huquqiga ega.
2. `pm` — Loyiha menejeri. Buyurtmalarni ko‘rib chiqadi, loyiha va vazifa yaratadi, jamoani boshqaradi, topshirilgan ishni tekshiradi.
3. `developer` — Dasturchi. Biriktirilgan vazifalar va a’zo bo‘lgan loyihalar bilan ishlaydi, ish jurnali yozadi, tekshiruvga yuboradi.
4. `department` — Boshqarma. O‘z buyurtmalarini yuboradi, holatini kuzatadi va shu buyurtmadan yaratilgan loyihaning yakunlanishini tasdiqlaydi yoki rad etadi.

Ro‘yxatdan o‘tishda ism, familiya, mutaxassislik, rol, login, parol va Telegram username olinadi. Boshqarma roli tanlansa boshqarma nomi kerak. Boshliq roli ochiq ro‘yxatdan o‘tishda tanlanmaydi.

Yangi akkaunt `is_active=False` bilan yaratiladi; administrator faollashtirmaguncha kirish mumkin emas. Mutaxassisliklar `Specialty` modeli orqali Django adminda boshqariladi.

PM va Boshliqning ko‘plab domen huquqlari `is_manager` bilan birlashtirilgan. PM huquqlarini faqat o‘zi yaratgan loyihalar bilan cheklangan deb taxmin qilma: amaldagi ruxsat funksiyasini o‘qi.

Frontenddagi yashirilgan tugma xavfsizlik chegarasi emas. API querysetlari ham, biznes amallari ham tegishli server ruxsatlari bilan ishlashi kerak.

### 5. Buyurtmalar va TZ versiyalari

Buyurtma: nom, izoh, muhimlik, boshqarma so‘ragan muddat va TZ fayli. Muhimlik: `low`, `medium`, `high`, `urgent`.

Holatlar:

```text
submitted → approved → project_created
submitted → rejected → yangi TZ versiyasi → submitted
```

- Buyurtmani Boshqarma yuboradi; yuborgach uning umumiy ma’lumotlarini tahrirlay yoki o‘chira olmaydi.
- PM/Boshliq tasdiqlashda boshlanish va tugash sanasi, izoh va kerak bo‘lsa muhimlikni belgilaydi.
- Boshqarma so‘ragan muddat va menejer belgilagan sanalar alohida maydonlar.
- Rad etishda sabab majburiy.
- Yangi TZ versiyasi faqat rad etilgandan keyin yuboriladi; oldingi versiyalar va qarorlar saqlanadi.
- Tasdiqlagan menejer `approved_by` sifatida qayd qilinadi.
- Bitta buyurtmaga bitta loyiha: `Project.order` — OneToOne.
- Loyiha yaratilgandan keyin buyurtma `project_created` holatida qoladi; loyiha yakunlash holati alohida qaytariladi.
- Boshqarma ro‘yxatida yakunlash tasdig‘i kutilayotganlar birinchi, yangi/faol buyurtmalar keyin, yakunlanganlar oxirida. Guruh ichida yangi yozuvlar oldin keladi.

### 6. Loyihalar va jamoa

Loyiha: majburiy va takrorlanmaydigan qo‘lda kiritiladigan kod (32 belgigacha), nom, izoh, boshlanish/tugash sanalari, yaratuvchi, ixtiyoriy buyurtma, dasturchilar va fayllar.

Amaldagi oltita daraja:

- `planned` — Rejalashtirilgan.
- `started` — Boshlangan.
- `needs_fix` — Tuzatish kerak.
- `rejected` — Rad etildi.
- `pending_approval` — Tasdiqlash kutilmoqda.
- `done` — Yakunlangan.

Bu holatlar oddiy ketma-ket progress bosqichlari emas. O‘tishlar `projects/workflow.py` orqali boshqariladi. `pending_approval` va `rejected` oddiy forma tanlovi emas, yakunlash jarayonida hosil bo‘ladi. `done` holatidan boshqa darajaga o‘tish yo‘q.

Loyihani faqat PM/Boshliq yaratadi. Uch qadamli wizard: Asosiy → Jamoa → Vazifalar va fayllar. Har tanlangan dasturchiga alohida boshlang‘ich vazifalar berish mumkin. `POST /api/projects/setup/` loyiha, jamoa va vazifalarni bitta tranzaksiyada yaratadi; bir vazifa xato bo‘lsa bazada chala loyiha qolmasligi kerak.

Buyurtmadan yaratilgan loyiha nomi, izohi va sanalari tahrirlansa, tegishli ma’lumot buyurtmaga ham ko‘chadi. TZ fayli shu tahrir tufayli almashtirilmaydi.

Jamoada faqat shu loyiha a’zolari ko‘rsatiladi; boshqa dasturchi qidiruv bilan qo‘shiladi. Jamoadan chiqariladigan dasturchi faol vazifaning yagona ijrochisi bo‘lsa, avval boshqa ijrochi kerak. Bajarilgan ishlar tarix sifatida saqlanadi.

### 7. Loyihani yakunlashning aniq jarayoni

1. PM/Boshliq yakunlashni boshlaydi; alohida amal modalida izoh (1000 belgigacha) va fayllar yuboriladi.
2. Loyihada faol dasturchilar bo‘lsa, har biriga `ProjectCompletionAck` yaratiladi va bildirishnoma yuboriladi. Ular javob berguncha loyiha darajasi darhol `done` bo‘lmaydi.
3. Har bir dasturchi rozilik beradi yoki majburiy sabab bilan rad etadi.
4. Birortasi rad etsa, tasdiqlash davri bekor qilinadi, loyiha davom etadi. Keyingi so‘rovda hammadan yana rozilik olinadi.
5. Hammasi rozi bo‘lgach menejerga bildirishnoma keladi; menejer yakunlashni yana bajaradi. Bu avtomatik yakunlash emas.
6. Buyurtmasiz loyiha `done` bo‘ladi.
7. Buyurtmali loyiha `pending_approval` bo‘ladi; buyurtmani yuborgan boshqarma buyurtma modalida hisobot va yakunlash fayllarini ko‘radi.
8. Faqat shu buyurtma egasi tasdiqlasa `done`; sabab bilan rad etsa `rejected` bo‘ladi. Menejer tuzatib qayta yakunlashni so‘rashi mumkin.

Faol dasturchi bo‘lmasa, dasturchilar roziligini olish bosqichi o‘tkazib yuboriladi. Jamoa o‘zgarsa faol tasdiqlash davri bekor qilinadi. Dasturchi tasdiqlari kutilayotgan, boshqarma tasdig‘i kutilayotgan yoki yakunlangan loyihaga yangi vazifa yaratish serverda taqiqlangan.

### 8. Vazifalar, ijrochilar va tekshiruv

Vazifa loyiha ichida yaratiladi: nom, izoh, muhimlik, boshlanish/tugash vaqti, bir yoki bir nechta ijrochi, topshiriqlar va fayllar. Har vazifaga avtomatik tasodifiy, takrorlanmaydigan 9 xonali kod beriladi. Loyiha kodi esa qo‘lda kiritiladi.

```text
control (Nazoratda)
→ in_progress (Jarayonda)
→ in_review (Tekshiruvda)
→ done (Bajarildi)

Tekshiruv qaytarilsa: in_review → in_progress
```

- PM/Boshliq vazifa yaratishi va tahrirlashi mumkin.
- Dasturchi a’zo bo‘lgan loyihasida o‘ziga vazifa yaratishi mumkin; yaratishda boshqa ijrochini tanlash serverda o‘ziga almashtiriladi.
- Dasturchi faqat o‘ziga biriktirilgan vazifani boshlaydi va tekshiruvga yuboradi. Tekshiruvga yuborish faqat dasturchi ijrochi uchun.
- Tekshiruvga yuborishda bajarilgan ish izohi va ixtiyoriy fayllar olinadi; har urinish `Submission` orqali saqlanadi.
- Faqat PM/Boshliq tekshiruvni qabul qilib `done` qiladi yoki sabab bilan qaytaradi.
- «To‘xtab qolgan» vazifa holati mavjud emas.
- Tugash vaqti boshlanish vaqtidan oldin bo‘lishi mumkin emas.
- Bajarilgan vazifa tahrirlanmaydi. Arxivdagi vazifa faqat o‘qiladi.
- `DELETE /api/tasks/{id}/` jismoniy o‘chirish emas: `archived_at` belgilanadi. Izoh, fayl, tekshiruv va ish jurnali saqlanadi; oddiy ro‘yxat va hisoblagichlardan chiqadi.
- «Muddati o‘tgan» — muddati o‘tgan faol vazifa; «Kechikib bajarilgan» — `completed_at > due_at`. Ular alohida workflow holatlari emas.
- Ommaviy yaratishda har qatorga vazifa va ijrochi beriladi; bir qator xato bo‘lsa butun DB tranzaksiyasi bekor qilinadi.

Ijrochilarni o‘zgartirishda PM/Boshliq har qanday ruxsatli vazifani boshqaradi. Dasturchi faqat o‘zi yaratgan vazifaga boshqa dasturchilarni qo‘sha oladi va o‘zini olib tashlay olmaydi.

Vazifa tafsilotlaridagi ijrochi tanlovida istalgan faol dasturchi chiqadi; loyiha jamoasida bo‘lmasa avtomatik a’zo qilinadi. Oddiy yaratish/tahrirlash formasi esa loyiha jamoasini tanlatadi.

`SubTask` — kichik topshiriq: nom, tartib, bajarilgan belgisi va bir nechta ijrochi. Ijrochisiz topshiriq UI’da «Hamma» deb ko‘rsatiladi. Topshiriqlarni menejer yoki asosiy vazifa ijrochisi boshqaradi.

Dasturchi ro‘yxati va qidiruviga faqat asosiy vazifa sifatida o‘ziga biriktirilgan yozuvlar kiradi (`listed_tasks`). Faqat sub-vazifasi biriktirilgan boshqa vazifa tafsilotini ko‘rishga ruxsat bo‘lishi mumkin (`visible_tasks`); bu ikki qoidani birlashtirib yuborma.

### 9. Ish jurnali, xodimlar va profil

- `WorkLog`: vazifa, muallif, ish sanasi, sarflangan soat va bajarilgan ish izohi. Soat `0 < hours <= 24`.
- Xodimlar sahifasi bandlikni ko‘rsatadi; bo‘sh dasturchiga to‘g‘ridan-to‘g‘ri vazifa berish mumkin.
- Xodim mas’uliyatlari 2000 belgigacha; PM/Boshliq boshqaradi.
- Xizmat safarini faqat Boshliq belgilaydi yoki muddatidan oldin tugatadi. Qaytish sanasigacha yangi vazifa/topshiriq biriktirish cheklanadi; mavjud biriktirishlar alohida hisobga olinadi.
- Profil: shaxsiy ma’lumotlar, Telegram username, parol almashtirish, avatar va dasturchining o‘z vazifalari.
- Profil va xodim tafsilotlari umumiy `ProfileHeader` va `TaskTable` kabi komponentlardan foydalanadi.
- Avatar JPG/PNG/WEBP, 5 MB gacha; Pillow tekshiradi, 1024 px gacha kichraytirib JPEGga aylantiradi, EXIF olib tashlanadi.

### 10. Qolgan funksiyalar

**Bosh panel:** rolga mos kartalar va filtrlangan ro‘yxat. Yil/oy/hafta boshidan hisoblar, faol, muddati o‘tgan, bajarilgan, kechikib bajarilgan va tekshiruvdagi ishlar. Boshqarma uchun buyurtma hisoblari. Karta soni va bosilganda ochiladigan ro‘yxat umumiy filtr qoidalariga tayanadi. Standart ish panelida hafta boshidan faol vazifalar jadvali ochiladi.

**Qidiruv:** Ctrl+K global qidiruv, vazifa/loyiha kodi, nom va tegishli matnlar. Vazifalar jadvali va bosh paneldagi vazifa qidiruvi kodning 1–2 raqamli qismini ham topadi; to‘liq mavjud kod aniq yozuvga yo‘naltiradi. Har endpointda aynan bir xil qidiruv xatti-harakati bor deb taxmin qilma.

**Taqvim:** vazifa muddatlari va loyiha tugash sanalari; kun bosilsa kun modali. Yozuv bosilsa mavjud tafsilot modali ochiladi va orqaga qaytish mavjud.

**Qilingan ishlar:** PM/Boshliq uchun bajarilgan vazifalar, tekshiruv qarorlari va faoliyat; filterlar va sahifalash bilan.

**Izohlar va tarix:** Order/Project/Task uchun umumiy `Comment` va `ActivityLog` modeli, GenericForeignKey bilan. Ko‘rish resurs ruxsatlariga bog‘liq.

**Chat:** foydalanuvchilar o‘rtasidagi shaxsiy xabarlar, sherikni qidirish, suhbatlar, oxirgi xabar va o‘qilmaganlar soni. Oxirgi 200 ta xabar olinadi. WebSocket mavjud deb yozma: xabarlar 5 soniyada, suhbatlar 15 soniyada polling orqali yangilanadi; yashirin tabda fon polling o‘chiq.

**Takliflar:** ochiq yoki anonim g‘oya, yoqlash/qarshi ovoz; bir foydalanuvchiga bir taklifda bitta ovoz. Qabul/rad qarorini Boshliq chiqaradi. Holatlar: pending/accepted/rejected.

**Bildirishnomalar:** tepadagi qo‘ng‘iroq orqali modal; kun bo‘yicha guruhlar, hammasi/o‘qilmagan filtri va o‘qildi belgilash. Tegishli vazifa, buyurtma yoki loyiha tafsilotini ochadi. Alohida bildirishnomalar sahifasi hozirgi route’larda yo‘q.

**Telegram:** username va botga `/start` orqali chat bog‘lanadi. `notify()` tizim bildirishnomasini bazaga yozadi; Telegram yuborish `transaction.on_commit` dan keyin daemon thread’da bajariladi. Bot `manage.py runbot` bilan alohida jarayon sifatida ishlaydi. Token muhit o‘zgaruvchisi yoki `backend/.env` ichida.

**TinyFish:** backendda `apps/ai`. PM/Boshliq vazifa matni va ixtiyoriy URL bilan asinxron ish boshlaydi. URL bo‘lsa sayt avtomatizatsiyasi, URL bo‘lmasa web tadqiqot. `WebAgentRun` ish egasi, provider ID, holat va JSON natijani saqlaydi. POST javobi 202; GET orqali holat yangilanadi. Natijani faqat ishni boshlagan foydalanuvchi oladi. Holatlar pending/running/completed/failed. `ai_web_agent` throttle: 5/hour; amaldagi view’da POST va GETga tatbiq etilgan. Timeout va ehtiyotkor retry bor; ish yaratadigan POST avtomatik qayta yuborilmaydi. Boshlang‘ich URL’ning HTTP/HTTPS sxemasi, host va DNS IP’lari tekshiriladi, private/local manzillar rad etiladi. Hozir frontendda unga alohida sahifa yoki integratsiya topilmagan. Tashqi xizmatning haqiqiy ishlashini lokal mock testlar isbotlamaydi.

### 11. Sahifalar va rollar

| Yo‘l | Sahifa | Foydalanish |
|---|---|---|
| `/` | Landing yoki bosh panel | Kirish holati va rolga qarab |
| `/kirish` | Kirish | Anonim |
| `/royxatdan-otish` | Ro‘yxatdan o‘tish | Anonim |
| `/vazifalar` | Vazifalar | PM/Boshliq/Dasturchi |
| `/mening-ishim` | Kanban doska | Dasturchi |
| `/tekshiruv` | Tekshiruv navbati | PM/Boshliq |
| `/loyihalar` | Loyihalar ro‘yxati | PM/Boshliq |
| `/buyurtmalar` | Buyurtmalar | PM/Boshliq/Boshqarma |
| `/taqvim` | Taqvim | PM/Boshliq/Dasturchi |
| `/xodimlar` | Xodimlar | PM/Boshliq |
| `/qilingan-ishlar` | Ishlar hisoboti | PM/Boshliq |
| `/takliflar` | Takliflar | Barcha faol rollar |
| `/xabarlar` | Chat | Barcha faol rollar |
| `/profil` | Shaxsiy profil | Barcha faol rollar |
| `/admin/` | Django admin | Django admin huquqi bor foydalanuvchi |

Dasturchi loyiha ro‘yxati sahifasiga kirmasa ham, ruxsatli loyihasining tafsilot modalini tegishli UI orqali ko‘ra oladi.

### 12. API va frontend holati

Asosiy API guruhlari:

- `/api/auth/`: csrf, register, login, logout, me, profile, password, avatar.
- `/api/orders/`: ro‘yxat/yaratish/tafsilot; `{id}/versions/`, `approve/`, `reject/`, `dates/`.
- `/api/projects/`: ro‘yxat/yaratish/tafsilot/tahrir; jamoa va fayllar; `{id}/completion-ack/`, `confirm-completion/`, `reject-completion/`.
- `/api/projects/setup/`: loyiha + jamoa + vazifalarni birga yaratish.
- `/api/tasks/`: ro‘yxat/yaratish/tafsilot/tahrir/arxiv; status, submit, review, files, subtasks, assignees, worklogs va `/bulk/` amallari.
- `/api/dashboard/`, `/api/people/`, `/api/developers/`, `/api/specialties/`, `/api/meta/`, `/api/search/`, `/api/workdone/`, `/api/history/`, `/api/comments/`.
- `/api/people/{id}/business-trip/`, `/api/people/{id}/responsibilities/`.
- `/api/notifications/`, `/api/chat/`, `/api/suggestions/`.
- `/api/files/{kind}/{id}/`, `/api/avatars/{id}/`.
- `/api/ai/web-agent/`, `/api/ai/web-agent/{id}/`.

Aniq HTTP metod va payloadni ishlatishdan oldin tegishli `api.py` va serializer’dan tekshir. Hujjatda eski endpoint uchrasa uni avtomatik mavjud deb hisoblama.

`shared/api.ts` `/api` prefiksini qo‘shadi; unga `/api/...` emas, `/tasks/...` kabi yo‘l beriladi. Cookie sessiya yuboriladi, o‘zgartiruvchi so‘rovga `X-CSRFToken` qo‘shiladi. JSON va multipart FormData qo‘llanadi. Xatolar `ApiError` orqali status, umumiy izoh va maydon xatolariga ajratiladi.

DRF oddiy ro‘yxatlar uchun sahifalash hajmi 50. Hisobotlar o‘z 20 yozuvli sahifalashidan foydalanadi. Doska/taqvim uchun ayrim endpointlarda `all=1` bor.

Query keshi odatda 60 soniya, dasturchilar ma’lumotnomasi 5 daqiqa. Faqat o‘zgargan domenlar keshini yangilash mavjud. Sahifalar lazy import qilinadi; loyiha tablaridagi ayrim ma’lumotlar tab ochilganda yuklanadi. Metama’lumot va o‘tishlar `/api/meta/` orqali olinadi.

### 13. UX/UI talablari

- 18–40 yoshli foydalanuvchiga tushunarli, oddiy o‘zbekcha matnlar.
- Ranglar, spacing, radius va o‘lchamlar `frontend/src/shared/styles.css` tokenlaridan.
- UI matnlari `shared/text.ts`, sana formatlash `shared/format.ts`, holat ko‘rinishi umumiy metadata/status vositalaridan.
- Yorug‘ va qorong‘i rejim, mobilga mos layout, 8 px asosiy setka.
- Umumiy boshqaruv balandliklari amaldagi CSS’da 32/40/48 px.
- Sahifada qidiruv/filtrlar chapda, amallar o‘ngda, asosiy amal eng o‘ngda. Sahifa nomi yuqori panelda; qayta katta sarlavha qo‘yilmaydi.
- Modal: yuqorida sarlavha va yopish, o‘rtada scroll, pastda doim ko‘rinadigan amallar; asosiy amal o‘ngda.
- Tafsilot, yaratish va tahrir modallarda. Tafsilot uchun drawer taqiqlangan; navigatsiya sidebar’i alohida tushuncha.
- Modal holati brauzer history state’da; URL toza qoladi. Back yopadi, refresh’da holat tiklanadi. Eski query havolalar qo‘llab-quvvatlanib tozalanadi.
- Odatda modal ichidagi ko‘rinish almashtiriladi. Tasdiqlangan istisnolar: vazifa amali, buyurtma amali va loyiha yakunlash modali asosiy modal ustida `stacked` ochiladi; orqadagi oyna `inert` bo‘ladi.
- Esc/Tab va fokus boshqaruvi, klaviatura bilan tablar, saqlanmagan o‘zgarishlarni yo‘qotishdan oldin tasdiq.
- Skeleton, maydon yonidagi xato, bo‘sh holat uchun keyingi qadam; holat va muddatni rang bilan birga matnda ko‘rsatish.
- Word hujjat joriy modal ichida ko‘rsatiladi va orqaga qaytish bor; PDF va rasmlar uchun ham viewer mavjud.
- Flow/modal reestrida 15 ta modal qayd qilingan; bu barcha ichki komponentlarning avtomatik hisoblangan soni emas.

### 14. Ma’lumotlar modellari

- Accounts: `User`, `Specialty`.
- Orders: `Order`, `OrderVersion`.
- Projects: `Project`, `ProjectMember`, `ProjectFile`, `ProjectCompletionAck`.
- Tasks: `Task`, `TaskAssignment`, `SubTask`, `TaskFile`, `Submission`, `SubmissionFile`, `WorkLog`.
- Core: `Comment`, `ActivityLog`.
- Notifications: `Notification`.
- Chat: `ChatMessage`.
- Suggestions: `Suggestion`, `SuggestionVote`.
- AI: `WebAgentRun`.

Buyurtma → loyiha 1:1; loyiha → vazifa 1:N; loyiha → dasturchi M:N; vazifa → ijrochi M:N; topshiriq → ijrochi M:N; vazifa → topshirish va ish jurnali 1:N. Tegishli takrorlanmaslik va soat chegaralari bazada constraintlar bilan ham himoyalangan.

### 15. Xavfsizlik va konfiguratsiya

- Auth so‘rovlari uchun throttle 20/min, Django parol validatorlari va heshlar.
- Sessiya cookie HttpOnly va SameSite=Lax; CSRF cookie’dan token headerga olinadi.
- `DEBUG=False` rejimida xavfsiz cookie, HTTPS redirect, HSTS va qo‘shimcha HTTP himoya sozlamalari mavjud; haqiqiy SECRET_KEY bo‘lmasa ishga tushmaydi.
- Fayllar `.docx`, `.pdf`, `.png`, `.jpg`, `.jpeg`, 20 MB gacha. Umumiy yuklash validatsiyasi kengaytma va hajmga tayanadi; uni to‘liq antivirus yoki fayl mazmuni auditi deb ta’riflama.
- Media to‘g‘ridan-to‘g‘ri ochiq route bilan berilmaydi; `/api/files/...` orqali egalik/ruxsat tekshiruvi. Avatar uchun autentifikatsiya talab qilinadi.
- Yakunlash fayllarining boshqarmaga berilishi tegishli buyurtma egaligi bilan cheklanadi.
- Sirlar `.env` yoki muhitda. Token, real parol va API kalitni kodga, promptga yoki logga chiqarma.
- Asosiy env nomlari: `DJANGO_SECRET_KEY`, `DJANGO_DEBUG`, `DJANGO_ALLOWED_HOSTS`, `DJANGO_CSRF_TRUSTED_ORIGINS`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TINYFISH_API_KEY`, `TINYFISH_TIMEOUT_SECONDS`, `TINYFISH_HTTP_RETRIES`.

### 16. Ishga tushirish va tekshiruv

Windows PowerShell, backend papkasida:

```powershell
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py createsuperuser
.\.venv\Scripts\python.exe manage.py seed_demo
.\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8020
```

`.venv` bo‘lmasa avval `python -m venv .venv` bilan yaratiladi. `seed_demo` faqat DEBUG rejimida; mavjud haqiqiy bazaga zaruratsiz ishlatilmasin. Telegram bot: `manage.py runbot`.

Frontend papkasida:

```powershell
npm install
npm run dev
```

Vite porti 5173; `/api` va `/admin` Django 8020 portiga proksi qilinadi.

Tekshiruvlar:

```powershell
# backend/ ichida
.\.venv\Scripts\python.exe manage.py check
.\.venv\Scripts\python.exe manage.py test
.\.venv\Scripts\python.exe manage.py makemigrations --check --dry-run

# frontend/ ichida
npm run typecheck
npm test
npm run build
```

Build `frontend/dist` ichiga tushadi; Django SPA index’ini beradi, asset URL’lari `/static/` ostida. Node build/ishlab chiqish uchun kerak. Haqiqiy deploymentda WSGI/ASGI va statik fayllarni berish alohida to‘g‘ri sozlanadi; mavjud `runserver` ishga tushirishni production server deb baholama.

Windows autostart uchun `backend/start_server.bat` mavjud; hujjatda Startup VBS bilan ulanishi yozilgan. Startup papkasidagi haqiqiy fayl ushbu repository tahlilida tekshirilmagan.

### 17. Mavjud loyiha bilan ishlash qoidalari

1. Avval README, CLAUDE/GEMINI qoidalari, flow/modal reestri va tegishli kodni o‘qi.
2. Faqat mening topshirig‘im doirasida ish qil; aytilmagan funksiya, sahifa, dependency yoki refaktoring qo‘shma.
3. Mavjud umumiy komponent va servisdan foydalan; biznes/ruxsat qoidasini bir necha joyda takrorlama.
4. Holat o‘tishlarini workflow va servislar orqali saqla; to‘g‘ridan-to‘g‘ri holat yozish bilan chetlab o‘tma.
5. Har bir o‘zgargan ruxsat chegarasi va holat uchun mos test bilan tekshir.
6. N+1 so‘rovlardan qoch; zarur `select_related`, `prefetch_related` va agregatlardan foydalan.
7. Yangi flow/modal talab qilinsa reestrni ko‘r; bir moduldagi 3–4 flow, istisnoda 5 flow chegarasini hisobga ol.
8. Commit, push va deploymentni faqat alohida topshiriq bo‘lsa bajar.
9. Hujjat va kod farq qilsa farqni aniq ko‘rsat. Yangi xatti-harakat tanlash talab qilinsa foydalanuvchi talabini aniqlashtir; eski hujjatni ko‘r-ko‘rona kodga qaytarma.
10. Natijada nima o‘zgargani, nima uchun, qanday tekshirilgani va qolgan cheklovni ayt. Sinov qilinmagan narsani sinovdan o‘tgan deb yozma.

### 18. Ma’lum farqlar va amaliy cheklovlar

- README va boshqa hujjatlardagi test/modal sonlari bir xil emas; amaldagi test natijasi va reestrdan foydalan.
- ARCHITECTURE’dagi ayrim model jadvali va workflow tavsifi eski: loyihada 6 holat, buyurtmaga nom/izoh/sana sinxronlash, dasturchining o‘ziga vazifa yaratishi va stacked modal istisnolari kodda mavjud.
- DESIGN_SYSTEM’dagi ayrim rang/o‘lchamlar eski; haqiqiy tokenlar `styles.css` ichida.
- `start_server.bat` amalda `0.0.0.0:8020` bilan ishlaydi; hujjatning ayrim joylarida faqat `127.0.0.1` deb yozilgan. Buni tuzatilgan yoki faqat loopback deb ko‘rsatma. `ALLOWED_HOSTS` alohida sozlama.
- Telegram daemon thread tizimi kafolatlangan yetkazish navbati emas: jarayon to‘xtasa yuborilmagan xabar yo‘qolishi mumkin. Hozir Celery/outbox mavjud deb yozma.
- SQLite, `all=1` ro‘yxatlar va oxirgi 200 chat xabari hozirgi yechimlar; katta yuklama uchun tayyorlik ushbu tahlilda o‘lchanmagan.
- TinyFish backend integratsiyasi bor, alohida frontend interfeysi topilmadi. Haqiqiy provayderga so‘rov yuborish va Telegram yetkazilishi bu tahlilda tekshirilmadi.
- Avtomatik testlar o‘tishi barcha brauzer ssenariylari, tashqi xizmat va production konfiguratsiyasi tekshirildi degani emas.

### 19. Mening topshirig‘im

**[Bu yerga kerakli ishni yozaman: masalan, «shu tizimga mos vazifa filtridagi muammoni tuzat», «loyiha yakunlash jarayonini tahlil qil» yoki «shu tavsif asosida texnik topshiriq tayyorla».]**

Avval topshiriqning kutilgan natijasini qisqa aniqlab ol. Keyin tegishli modullarni ko‘rib, mavjud tizimga mos ishni bajar. Faqat tushuntirish yoki tahlil so‘ralgan bo‘lsa, kodni o‘zgartirma.

---

## Ushbu tahlilning tekshiruv dalillari

- Backend: `manage.py test` — **243 test, OK**; runner system check’da muammo topilmadi.
- Frontend: `npm run typecheck` — o‘tdi.
- Frontend: `npm test` — **25 fayldagi 102 test o‘tdi**.
- Ushbu tahlilda build, haqiqiy browser E2E, tashqi TinyFish/Telegram so‘rovlari va production yuklamasi bajarilmadi.
- Ilova kodi, baza va mavjud sozlamalar o‘zgartirilmadi; ushbu prompt hujjati qo‘shildi.

## Prompt sifatini ichki baholash

| Mezoni | Baho | Dalil va yaxshilash imkoniyati |
|---|---:|---|
| Aniqlik | 4/5 | Rollar, workflow, endpointlar va hujjat farqlari kod bilan solishtirildi; haqiqiy tashqi integratsiyalar tekshirilmagan. |
| Qamrov | 4/5 | Barcha asosiy domenlar, UX, modellar, API va ishga tushirish qamrab olindi; har endpointning to‘liq payload sxemasi kiritilmadi. |
| Tushunarlilik | 4/5 | O‘zbekcha bo‘limlar va aniq jarayonlar bor; ayrim texnik atamalar dasturchi bilimini talab qiladi. |
| Ishlatish qulayligi | 4/5 | Tayyor prompt, topshiriq uchun joy va tekshiruv buyruqlari bor; boshqa muhitda virtual muhit yo‘li moslashtiriladi. |
| Ixchamlik | 4/5 | Keng loyiha uchun zarur tafsilotlar berildi; bitta kichik topshiriqda faqat tegishli bo‘limlarni berish mumkin. |

O‘rtacha: **4.0/5**. Eng foydali keyingi yaxshilashlar: aniq topshiriq uchun promptni qisqartirish; kerakli API payloadlarini qo‘shish; tashqi xizmat talab qilinsa alohida amaliy tekshiruv dalilini olish. Baholash foydalanuvchining «to‘liq prompt» talabiga nisbatan qilindi; foydalanishdagi qulayligini foydalanuvchi baholaydi.
