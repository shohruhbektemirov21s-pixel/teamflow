"""Vazifa kodi va loyiha raqamini bitta joydan topish (qidiruv uchun).

**Vazifa** (`Task.code`) yaratilganda tasodifiy 9 xonali kod oladi — ketma-ket emas, umumiy
sonni ko'rsatmaydi (`generate_unique_code`).

**Loyiha** (`Project.code`) endi avtomatik berilmaydi — PM/Boshliq loyiha yaratishda qo'lda
kiritadigan erkin matn/kod (masalan `PRJ-12`), `unique=True` bilan takrorlanishdan himoyalangan
(`apps/projects/services.py`).

`resolve_code` ikkalasini ham qidiradi: avval matn 9 xonali ko'rinishda bo'lsa vazifa kodi
sifatida, keyin aniq (exact) moslik bo'yicha loyiha raqami sifatida tekshiradi.

`core` eng pastki qatlam — `tasks`/`projects` modellarini statik import qilmaydi
(ARCHITECTURE 3-bo'lim). `django.apps.apps.get_model` orqali teskari bog'lanishsiz olinadi
(xuddi `projects/services.py` dagi kabi).
"""
import random
import re

from django.apps import apps

CODE_LENGTH = 9
_CODE_RE = re.compile(rf"^\d{{{CODE_LENGTH}}}$")


def looks_like_code(text):
    """Matn vazifaning avtomatik 9 xonali kodiga o'xshaydimi (loyiha raqami erkin matn, bu yerga kirmaydi)."""
    return bool(_CODE_RE.match((text or "").strip()))


def _random_digits():
    return "".join(str(random.randint(0, 9)) for _ in range(CODE_LENGTH))


def generate_unique_code():
    """Task.code uchun hali ishlatilmagan tasodifiy 9 xonali kod."""
    Task = apps.get_model("tasks", "Task")
    while True:
        candidate = _random_digits()
        if not Task.objects.filter(code=candidate).exists():
            return candidate


def resolve_code(text):
    """Kod bo'lsa ("task" | "project", pk), aks holda None. Bazadan tekshiradi.

    Vazifa kodi doim 9 xonali bo'lgani uchun avval shu naqshga mos kelsa tekshiriladi.
    Loyiha raqami erkin matn bo'lgani uchun aniq (exact, katta-kichik harf farqlab) moslik
    bo'yicha alohida tekshiriladi.
    """
    code = (text or "").strip()
    if not code:
        return None
    Task = apps.get_model("tasks", "Task")
    Project = apps.get_model("projects", "Project")
    if looks_like_code(code):
        task_pk = Task.objects.filter(code=code).values_list("pk", flat=True).first()
        if task_pk:
            return "task", task_pk
    project_pk = Project.objects.filter(code=code).values_list("pk", flat=True).first()
    if project_pk:
        return "project", project_pk
    return None
