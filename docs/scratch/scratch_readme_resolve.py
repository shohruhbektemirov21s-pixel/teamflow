import os

path = "README.md"
with open(path, "r", encoding="utf-8") as f:
    text = f.read()

replacement = """**Qaror sifatida qabul qilinganlar:**
- **Muhimlik turi:** boshqarma buyurtma yuborganda tanlaydi, PM tasdiqlaganda o'zgartira oladi.
- **Mas'ul PM:** buyurtmani tasdiqlagan PM avtomatik mas'ul bo'ladi. Dasturchilar loyiha yaratilganda biriktiriladi.
- **Sub-vazifalar:** kichik qadamlar, har biriga dasturchi biriktirish mumkin.
- **Xabarlar (Chat):** Foydalanuvchilar orasida shaxsiy yozishma qilish funksiyasi qo'shildi.
- **Ommaviy vazifalar:** Bir qancha vazifalarni matn shaklida birdan yaratish.
- **Mutaxassisliklar ro'yxati:** Backend, Frontend, Mobil, UI/UX Dizayner, QA (Tester), Loyiha Menejeri (PM).
- **Boshqarma rolining yon paneli:** Buyurtmalar, Xabarlar, Bildirishnomalar, Takliflar, Umumiy tarix.
- **Autentifikatsiya usuli:** Cookie / Session asosida (Django REST Framework standard cookie auth).
- **Fayl turlari va hajm:** .docx, .pdf, .png, .jpg. Hajm chegarasi: 20 MB.
- **Takliflar bo'limi:** Tizimni yaxshilash bo'yicha g'oyalar (Kutmoqda, Qabul qilingan, Rad etilgan holatlari bilan)."""

import re
text = re.sub(
    r"\*\*Qaror sifatida qabul qilinganlar.*?## 11\. Ishga tushirish yo'riqnomasi",
    replacement + "\n\n## 11. Ishga tushirish yo'riqnomasi",
    text,
    flags=re.DOTALL
)

with open(path, "w", encoding="utf-8") as f:
    f.write(text)

print("Removed all open questions from README.md")
