"""Vazifa va loyihaning tasodifiy 9 xonali kodi — BITTA joyda.

Har bir vazifa/loyiha yaratilganda tasodifiy 9 xonali kod beriladi va modelda saqlanadi
(Task.code / Project.code) — ketma-ket emas, umumiy sonni ko'rsatmaydi. Kod Task va Project
orasida ham takrorlanmaydi, shuning uchun bitta kod faqat bitta vazifa yoki loyihani anglatadi.
Qidiruvda shu 9 xonali raqam yozilsa, aynan o'sha yozuv chiqadi (`resolve_code`).

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
    return bool(_CODE_RE.match((text or "").strip()))


def _random_digits():
    return "".join(str(random.randint(0, 9)) for _ in range(CODE_LENGTH))


def generate_unique_code():
    """Task.code va Project.code orasida hali ishlatilmagan tasodifiy 9 xonali kod."""
    Task = apps.get_model("tasks", "Task")
    Project = apps.get_model("projects", "Project")
    while True:
        candidate = _random_digits()
        if not Task.objects.filter(code=candidate).exists() and not Project.objects.filter(code=candidate).exists():
            return candidate


def resolve_code(text):
    """Kod bo'lsa ("task" | "project", pk), aks holda None. Bazadan tekshiradi."""
    if not looks_like_code(text):
        return None
    Task = apps.get_model("tasks", "Task")
    Project = apps.get_model("projects", "Project")
    code = text.strip()
    task_pk = Task.objects.filter(code=code).values_list("pk", flat=True).first()
    if task_pk:
        return "task", task_pk
    project_pk = Project.objects.filter(code=code).values_list("pk", flat=True).first()
    if project_pk:
        return "project", project_pk
    return None
