# TeamFlow: tezlik va 10 000 faol foydalanuvchi sinovi

2026-10-06. Talab: bir vaqtda 10 000+ faol foydalanuvchi; server hali tanlanmagan. Yakuniy sinov ushbu HTTP yuklama profilida o'tdi. Bu natija boshqa server yoki barcha mumkin bo'lgan foydalanuvchi amallariga avtomatik kafolat bermaydi.

## Yakuniy natija

| Ko'rsatkich | O'lchov |
|---|---:|
| Bir vaqtda virtual foydalanuvchi | 10 000, alohida sessiyalar |
| To'liq yuklamada uzluksiz vaqt | 250 soniya |
| To'liq yuklamada so'rov tezligi | 501,96 so'rov/soniya |
| Jami so'rov | 135 349 |
| Xato javob | 0 |
| Umumiy p95 / p99 | 110 / 260 ms |
| Peak davridagi rolling p95 maksimumi | 260 ms |
| Eng sekin asosiy endpoint p95 | Xodimlar ro'yxati: 480 ms |

Mezon: 10 000 foydalanuvchiga chiqish, kamida 120 soniya shu yuklamada ishlash, xatolar <1%, umumiy p95 ≤500 ms. Mustaqil `analyze.py` CSV tarixida uzluksiz peak vaqtini tekshirdi; uzilib qolgan qisqa peaklarni qo'shib yuborish va 1% xatoni o'tkazib yuborishga qarshi regression testlar bor. Percentillar Locust hisoblagan taxminiy qiymatlar.

Dalillar: [summary.json](summary.json), [endpointlar CSV](10k_stats.csv), [yuklama tarixi](10k_stats_history.csv), [resurslar](resources.json), [brauzer tekshiruvi](browser.json), [kirish/chiqish tekshiruvi](browser-auth.json).

## Sinov sharoiti va chegarasi

Windows host: 20 mantiqiy CPU, taxminan 15,7 GiB RAM. Docker VM: 20 CPU, taxminan 7,6 GiB RAM. Gunicorn: 12 jarayon × 2 oqim; PostgreSQL 16, Redis 7, Nginx 1.28. Yuklama generatori: Linux konteynerda Locust 2.46.7, 4 alohida jarayon. Har bir generator jarayoni boshqa sessiyalar to'plamidan foydalanadi. Yakuniy capacity o'lchovida build, unit/integration yoki brauzer testlari parallel bajarilmadi.

Sun'iy baza: 10 000 foydalanuvchi (1 boshliq, 499 PM, 1000 boshqarma, 8500 dasturchi), 2000 loyiha, 50 000 vazifa, 50 000 sub-vazifa, 50 000 bildirishnoma, 8500 chat xabari va 10 000 sessiya. Alohida brauzer login testi yana bitta sun'iy akkaunt yaratdi. HTTP so'rovlar haqiqiy session/CSRF, Nginx, Gunicorn, Django, Redis va PostgreSQL orqali o'tdi; API javoblari soxtalashtirilmadi. PostgreSQL sinov bazasi nomi `teamflow_scale`.

Har bir foydalanuvchi 10–30 soniyada bir amal qiladi: 40% o'qilmagan bildirishnoma soni, 20% rolga mos bosh panel, 15% ro'yxatlar, 10% tafsilot/xodimlar, 10% chat, 5% ish soatlari yozuvi; mos bo'lmagan rollarda o'qish so'rovi bajariladi. Jami 4381 ish soatlari yozuvi POST orqali bajarildi. Bu to'liq brauzerlarning barcha fon pollinglari bilan bir xil yuklama emas. Login to'lqinlari, katta fayllar, ommaviy yakunlash/Telegram fanout, tashqi provayder cheklovlari, ko'p soatlik soak va failover alohida sinov talab qiladi. Boshliqning yakuniy dashboard yuklama namunasi juda kichik; uning funksiyasi backend va brauzer testlarida tekshirildi.

## Resurslar

Docker stats har taxminan 10 soniyada olindi, 31 namuna. Quyidagilar namunalardagi maksimumlar; uzluksiz apparat monitoringi emas. CPU'da 100% — bitta CPU yadrosining ulushi.

| Xizmat | CPU maksimumi | RAM maksimumi |
|---|---:|---:|
| Django/Gunicorn | 702,89% | 897,4 MiB |
| PostgreSQL | 275,35% | 208,4 MiB |
| Redis | 9,90% | 13,89 MiB |
| Nginx | 19,02% | 39,27 MiB |
| Alohida yuklama generatori | 112,14% | 461,6 MiB |

So'rovlar sahifalanadi; har javob odatda 50, ko'pi bilan 100 qator. Eski `all=1` chaqiruvi 1000 dan ortiq natijada tushunarli 400 qaytaradi, ma'lumotni yashirin kesmaydi. Xodim vazifalarining to'liq soni saqlanadi, qisqa ko'rinish SQL window orqali 3 tagacha olinadi. Taqvim ≤43 kun oralig'ida to'liq sonlar va kuniga 3 preview qaytaradi. Loyiha tanlash faqat ID/nom/kodni oladi; barcha loyiha nomlarini yig'ish hali loyihalar soniga proporsional. Dasturchi tanlash server qidiruvi orqali dastlabki 200 tadan tashqaridagi xodimni ham topadi.

## Tuzatishlar va tekshiruv

Vazifa ruxsatlari barcha 50 000 vazifani korrelyatsiyalangan OR sharti bilan aylanib chiqish o'rniga indekslangan assignment/subtask ID to'plamlari orqali olinadi. Progress sonlari faqat kerakli qatorlar uchun subquery orqali hisoblanadi. Umumiy ro'yxat uchun keraksiz DISTINCT olib tashlandi; ko'p ijrochi nomi qidiruvida takrorlardan himoya saqlandi. Mos indekslar va barqaror sahifalash tartibi qo'shildi. Chat yangi xabarlarnigina oladi; bo'sh polling UPDATE qilmaydi. Mutatsiyalar tegishli keshni yangilaydi.

Production SQLite o'rniga PostgreSQL va umumiy Redis talab qiladi. Sessiyalar `cached_db` orqali bazada ham saqlanadi. Telegram so'rov ichida cheksiz oqim yaratish o'rniga tranzaksiyali outbox, qisqa lease va cheklangan retry bilan alohida workerga o'tadi. Nginx gzip/static cache, readiness/liveness, Django uchun non-root konteyner va resurs chegaralari qo'shildi. HTTPS gateway, backup, ulanishlar chegarasi va deploy buyruqlari [qo'llanmada](../../../backend/deploy/README.md).

Diagnostik 10 000-user bosqichi SQL va Gunicorn recycling muammolari bilan mezondan o'tmadi (p95 20 soniya, xatolar bor). Ishchi jarayonlarni avtomatik yangilash concurrent so'rovlarni uzgani uchun default recycling o'chirildi. Keyingi bir jarayonli generator sinovi xatosiz bo'lsa ham p95 1,1 soniya bo'lib mezondan o'tmadi; CPU ogohlantirishi bor va boshqa tekshiruvlar bilan ustma-ust kelgan. U yakuniy capacity dalili sifatida olinmadi. Yakuniy 4 jarayonli generator sinovi va mustaqil CSV tekshiruvi yuqoridagi mezondan o'tdi. Worker statistikasi shutdown'da tozalangani sabab worker exit baholashidagi yolg'on xato keyin tuzatildi; master/CSV natijasi saqlangan. Shu tuzatishdan keyingi 4 jarayonli, 1000-user smoke: 1787 so'rov, 0 xato, p95 30 ms, exit 0.

- PostgreSQL: **269 backend testi o'tdi**, jumladan parallel start/submit tranzaksiya sinovlari.
- SQLite: 269 holat, 267 o'tdi; PostgreSQL row-lock talab qiluvchi 2 holat o'tkazib yuborildi.
- Frontend: lockfile orqali `npm ci`, **104 test**, TypeScript va production build o'tdi; `npm audit` 0 zaiflik.
- Haqiqiy Edge: **60 sahifa/rol/kenglik holati**, 0 runtime/API xatosi, 0 sahifa overflow; xodimlar ikkinchi sahifasi ochildi.
- Brauzer auth: noto'g'ri parol rad etildi, kirish, reload sessiyasi, chiqish va chiqilgandan keyingi ruxsat rad etilishi — 5/5.
- `makemigrations --check` va Django check o'tdi. Production `check --deploy`: faqat W021, HSTS preload domen tanlanmaguncha ataylab yoqilmadi. HTTPS/secure cookie talablari default'da yoqilgan; faqat loopback testida o'chirilgan.
- Mahalliy SQLite backup olindi; indeks/outbox migratsiyalari qo'llandi, mavjud biznes jadvallaridagi qatorlar soni saqlandi. Mahalliy server yangilandi: root, JS asset, readiness va meta — 200.

Tozalash tekshirildi: `teamflow-scale-test` konteynerlari, tarmog'i, PostgreSQL bazasi, Redis ma'lumotlari va 3 named volume olib tashlandi. Sun'iy sessiyalar `users.json`, brauzer paroli `browser-login.json` va `.scale.env` o'chirildi. Shu project yorlig'ida konteyner/volume qolmagan; maxfiy fixture fayllari yo'q. Boshqa Docker loyihalari ishlashda davom etdi. Biznes SQLite bazasi va backup saqlandi, mahalliy readiness 200. Git'ga faqat kod, konfiguratsiya shabloni va anonim/umumlashtirilgan dalillar kiritildi; maxfiy qiymatlar staged diff'da tekshirildi.

Visual baseline bo'lmagani uchun vizual regression xulosasi chiqarilmadi. Bu tekshiruv yangi to'liq accessibility auditi emas. Production server hali tanlanmagan; o'sha serverda shu harnessni qayta o'tkazish kerak. Haqiqiy SQLite → PostgreSQL ko'chirish ushbu ishda bajarilmadi.

## O'zini baholash

`agent-self-evaluation` bo'yicha: aniqlik 5/5 (CSV va mustaqil analyzer, umumiy kafolat berilmagan); to'liqlik 4/5 (tanlangan production server va uzoq soak yo'q); tushunarlilik 4/5 (ops tafsilotlari texnik o'quvchiga mo'ljallangan); amaliy qo'llash 4/5 (tayyor Compose, lekin haqiqiy server/TLS va data cutover hali kerak); ixchamlik 4/5 (hisobot dalillar uchun uzun, foydalanuvchiga yakun qisqa). O'rtacha 4,2/5. Keyingi eng muhim tekshiruvlar: tanlangan serverda capacity, login/fayl/uzoq soak, backup restore. Foydalanuvchi o'lchangan natija va uning aniq chegarasi bilan bu bahoga qo'shila oladi.
