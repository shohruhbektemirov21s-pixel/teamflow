"""Vazifalar: kim nimani ko'radi va qila oladi — BITTA joyda."""
from django.db.models import Q

from .models import Task


def visible_tasks(user):
    """PM/Boshliq — hammasi. Dasturchi — o'ziga biriktirilgan yoki sub-vazifasi bor vazifalar."""
    qs = Task.objects.select_related("project", "created_by")
    if user.is_manager:
        return qs
    if user.is_developer:
        return qs.filter(Q(assignments__developer=user) | Q(subtasks__assignees=user)).distinct()
    return qs.none()


def listed_tasks(user):
    """Ro'yxat va qidiruv: dasturchiga faqat o'ziga biriktirilganlar.
    Faqat sub-vazifasi bor boshqa vazifa ro'yxatda chiqmaydi, lekin ochiladi (visible_tasks)."""
    qs = visible_tasks(user)
    if user.is_developer:
        return qs.filter(assignments__developer=user)
    return qs


def is_assignee(user, task):
    return task.assignments.filter(developer=user).exists()


def can_manage_assignees(user, task):
    """Vazifa ijrochilarini o'zgartirish: menejer yoki vazifani o'zi yaratgan dasturchi."""
    return user.is_manager or (user.is_developer and task.created_by_id == user.pk)


def can_manage_subtasks(user, task):
    """Sub-vazifa qo'shish, o'chirish va ijrochilarini o'zgartirish: menejer yoki vazifa ijrochisi."""
    return user.is_manager or (user.is_developer and is_assignee(user, task))


def can_work_on(user, task):
    """Holatni oldinga surish / tekshiruvga yuborish: ijrochi yoki menejer."""
    return user.is_manager or (user.is_developer and is_assignee(user, task))
