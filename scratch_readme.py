import os

path = "README.md"
with open(path, "r", encoding="utf-8") as f:
    text = f.read()

text = text.replace(
    "- Sub-vazifalar: kichik qadamlar, har biriga dasturchi biriktirish mumkin.",
    "- Sub-vazifalar: kichik qadamlar, har biriga dasturchi biriktirish mumkin.\n- **Xabarlar (Chat):** Foydalanuvchilar orasida shaxsiy yozishma qilish funksiyasi qo'shildi.\n- **Ommaviy vazifalar:** Bir qancha vazifalarni matn shaklida birdan yaratish."
)

text = text.replace(
    '5. "Takliflar" va "Xabarlar" bo\'limlari nimani qiladi (dizaynda bor, talab yozilmagan).',
    '5. "Takliflar" bo\'limi nimani qiladi (dizaynda bor, talab yozilmagan).'
)

with open(path, "w", encoding="utf-8") as f:
    f.write(text)

print("Updated README.md")
