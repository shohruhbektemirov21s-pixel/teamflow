"""Vazifa va loyihalarning qisqa kodlari (`TSK-12`, `PRJ-3`) — BITTA joyda.

Kod bazadagi `id` dan hisoblanadi, alohida saqlanmaydi. Qidiruvda kod yozilsa, aynan o'sha yozuv chiqadi.
"""
import re

TASK_PREFIX = "TSK"
PROJECT_PREFIX = "PRJ"

# "TSK-12", "tsk12", "TSK 12", "#12" emas — faqat prefiks bilan (oddiy raqam matn qidiruviga ketadi).
_CODE_RE = re.compile(rf"^({TASK_PREFIX}|{PROJECT_PREFIX})[-\s]?(\d+)$", re.IGNORECASE)


def task_code(pk):
    return f"{TASK_PREFIX}-{pk}"


def project_code(pk):
    return f"{PROJECT_PREFIX}-{pk}"


def parse_code(text):
    """Kod bo'lsa ("task" | "project", id), aks holda None."""
    match = _CODE_RE.match((text or "").strip())
    if not match:
        return None
    kind = "task" if match.group(1).upper() == TASK_PREFIX else "project"
    return kind, int(match.group(2))
