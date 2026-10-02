"""Loyiha daraja (stage) o'tishlari — BITTA jadvalda.

planned/started/needs_fix o'rtasida PM/Boshliq erkin almashtiradi.
Yakunlash: buyurtmasiz loyiha to'g'ridan-to'g'ri "done" bo'ladi; buyurtmadan yaratilgan loyiha
avval "pending_approval" ga o'tadi (services.set_stage hal qiladi) va faqat BUYURTMANI YUBORGAN
boshqarma uni "done" (tasdiqlash) yoki "needs_fix" (rad etish, sabab bilan) qila oladi.
Bajarilgan ("done") loyiha holati boshqa holatga o'zgarmaydi.
"""
from apps.accounts.models import Role
from apps.core.workflow import allowed_targets, check_transition

from .models import Project

S = Project.Stage
MANAGERS = {Role.PM, Role.BOSS}
DEPARTMENT = {Role.DEPARTMENT}

TRANSITIONS = {
    (S.PLANNED, S.STARTED): MANAGERS,
    (S.PLANNED, S.NEEDS_FIX): MANAGERS,
    (S.STARTED, S.PLANNED): MANAGERS,
    (S.STARTED, S.NEEDS_FIX): MANAGERS,
    (S.NEEDS_FIX, S.PLANNED): MANAGERS,
    (S.NEEDS_FIX, S.STARTED): MANAGERS,
    # Yakunlashni so'rash — target aniq "stage" qiymati services.set_stage da hal qilinadi:
    # buyurtmasiz loyihada bevosita DONE, buyurtmali loyihada PENDING_APPROVAL.
    (S.PLANNED, S.DONE): MANAGERS,
    (S.STARTED, S.DONE): MANAGERS,
    (S.NEEDS_FIX, S.DONE): MANAGERS,
    (S.PLANNED, S.PENDING_APPROVAL): MANAGERS,
    (S.STARTED, S.PENDING_APPROVAL): MANAGERS,
    (S.NEEDS_FIX, S.PENDING_APPROVAL): MANAGERS,
    # Boshqarmaning qarori (faqat buyurtmani yuborgan boshqarma — services tekshiradi)
    (S.PENDING_APPROVAL, S.DONE): DEPARTMENT,
    (S.PENDING_APPROVAL, S.NEEDS_FIX): DEPARTMENT,
}


def check_project_transition(current, target, role):
    check_transition(TRANSITIONS, current, target, role)


def project_targets(current, role):
    return allowed_targets(TRANSITIONS, current, role)
