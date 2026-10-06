"""Parol xeshi: Argon2id, OWASP tavsiyasi bo'yicha (m=19 MiB, t=2, p=1).

Nima uchun: PBKDF2 (Django 5.2, 1 000 000 iteratsiya) har login uchun ~0,35 s CPU oladi — ertalab minglab xodim
bir vaqtda kirganda server faqat parol tekshirish bilan band bo'lib qoladi. Argon2id xotiraga bog'liq algoritm
(GPU/ASIC bilan buzish qimmat) va bir necha barobar kam CPU oladi. Django'ning standart parametrlari
(100 MiB, 8 oqim) har login uchun 100 MiB xotira oladi — bir vaqtdagi loginlarda RAM tez to'ladi, shuning uchun
OWASP minimal xotira varianti tanlangan.

Eski (PBKDF2) xeshlar `PASSWORD_HASHERS` da qoladi: xodim keyingi muvaffaqiyatli kirishda avtomatik Argon2id'ga
o'tkaziladi (Django `check_password` → `must_update`), parolni almashtirish shart emas.
"""
from django.contrib.auth.hashers import Argon2PasswordHasher


class Argon2idHasher(Argon2PasswordHasher):
    # algorithm nomi "argon2" qoladi — parametrlar xesh ichida saqlanadi, eski argon2 xeshlar ham tekshiriladi
    time_cost = 2
    memory_cost = 19456  # KiB = 19 MiB
    parallelism = 1
