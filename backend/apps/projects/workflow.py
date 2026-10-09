"""Loyiha daraja (stage) o'tishlari — BITTA jadvalda.

planned/started/needs_fix o'rtasida PM/Boshliq erkin almashtiradi.
Yakunlash: buyurtmasiz loyiha to'g'ridan-to'g'ri "done" bo'ladi; buyurtmadan yaratilgan loyiha
avval "pending_approval" ga o'tadi (services.set_stage hal qiladi) va faqat BUYURTMANI YUBORGAN
boshqarma uni "done" (tasdiqlash) yoki "rejected" (rad etish, sabab bilan) qila oladi.
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
    (S.REJECTED, S.PLANNED): MANAGERS,
    (S.REJECTED, S.STARTED): MANAGERS,
    (S.REJECTED, S.NEEDS_FIX): MANAGERS,
    (S.REJECTED, S.DONE): MANAGERS,
    (S.REJECTED, S.PENDING_APPROVAL): MANAGERS,
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
    (S.PENDING_APPROVAL, S.REJECTED): DEPARTMENT,
}


def check_project_transition(current, target, role):
    check_transition(TRANSITIONS, current, target, role)


def project_targets(current, role):
    """UI uchun tanlanadigan daraja ro'yxati. `PENDING_APPROVAL` bunga kirmaydi — u foydalanuvchi
    tanlovi emas, `services._apply_stage` "done" so'ralganda hosil qiladigan ichki oraliq holat."""
    return [t for t in allowed_targets(TRANSITIONS, current, role) if t not in (S.PENDING_APPROVAL, S.REJECTED)]


def active_members(project):
    """Loyihadagi faol dasturchilar — yakunlashdan oldin shularga tasdiq so'raladi."""
    return [m.developer for m in project.memberships.select_related("developer") if m.developer.is_active]


def completion_locked(project):
    """Yakunlangan, boshqarma tasdig'ini kutayotgan yoki dasturchilardan yakunlash tasdig'i so'ralgan loyiha:
    yangi vazifa qo'shish va ish biriktirish yopiq. Qoida BITTA joyda: servislar va serializerlar shundan oladi."""
    return project.stage in (S.DONE, S.PENDING_APPROVAL) or project.completion_requested_at is not None


def pending_acks(project):
    """Hali javob bermagan yakunlash tasdiqlari: faqat hozirgi jamoadagi FAOL dasturchilarniki.
    "Hamma rozimi?" qoidasi BITTA joyda: bloklangan yoki jamoadan chiqqan dasturchi yakunlashni to'xtatib qo'ymaydi.
    (memberships va completion_acks__developer prefetch qilingan bo'lsa, qo'shimcha so'rov yo'q.)"""
    if project.completion_requested_at is None:
        return []
    member_ids = {m.developer_id for m in project.memberships.all()}
    return [a for a in project.completion_acks.all()
            if a.confirmed is None and a.developer_id in member_ids and a.developer.is_active]
