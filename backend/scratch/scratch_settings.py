import os

path = "backend/config/settings.py"
with open(path, "r", encoding="utf-8") as f:
    text = f.read()

text = text.replace(
    '"apps.suggestions",',
    '"apps.suggestions",\n    "apps.chat",'
)

with open(path, "w", encoding="utf-8") as f:
    f.write(text)

print("Updated settings")
