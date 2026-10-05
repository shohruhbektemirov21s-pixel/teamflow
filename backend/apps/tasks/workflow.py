"""Vazifa holat mashinasi — o'tishlar BITTA jadvalda.

control ──▶ in_progress ──(submit)──▶ in_review ──(qabul)──▶ done
                  ▲                        │
                  └────────(qaytarish)─────┘

`done` ga faqat tekshiruv qabul qilganda o'tiladi; dasturchi to'g'ridan-to'g'ri `done` qila olmaydi.
"""
from apps.accounts.models import Role
from apps.core.workflow import allowed_targets, check_transition

from .models import Task

S = Task.Status
MANAGERS = {Role.PM, Role.BOSS}
STARTERS = {Role.DEVELOPER, Role.PM, Role.BOSS}

TRANSITIONS = {
    (S.CONTROL, S.IN_PROGRESS): STARTERS,
    (S.IN_PROGRESS, S.IN_REVIEW): {Role.DEVELOPER},  # faqat biriktirilgan dasturchi submit qiladi
    (S.IN_REVIEW, S.DONE): MANAGERS,  # tekshiruv: qabul
    (S.IN_REVIEW, S.IN_PROGRESS): MANAGERS,  # tekshiruv: qaytarish
}


def check_task_transition(current, target, role):
    check_transition(TRANSITIONS, current, target, role)


def task_targets(current, role):
    return allowed_targets(TRANSITIONS, current, role)
