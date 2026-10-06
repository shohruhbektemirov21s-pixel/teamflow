"""Vazifalar: kim nimani ko'radi va qila oladi — BITTA joyda."""
from .models import SubTask, Task, TaskAssignment


def visible_tasks(user):
    """PM/Boshliq — hammasi. Dasturchi — o'ziga biriktirilgan yoki sub-vazifasi bor vazifalar."""
    qs = Task.objects.select_related("project", "created_by")
    if user.is_manager:
        return qs
    if user.is_developer:
        assigned = TaskAssignment.objects.filter(developer=user).order_by().values("task_id")
        subtasks = SubTask.objects.filter(assignees=user).order_by().values("task_id")
        return qs.filter(pk__in=assigned.union(subtasks))
    return qs.none()


def listed_tasks(user):
    """Ro'yxat va qidiruv: dasturchiga faqat o'ziga biriktirilganlar.
    Faqat sub-vazifasi bor boshqa vazifa ro'yxatda chiqmaydi, lekin ochiladi (visible_tasks)."""
    qs = visible_tasks(user).filter(archived_at__isnull=True)
    if user.is_developer:
        return Task.objects.select_related("project", "created_by").filter(
            archived_at__isnull=True,
            pk__in=TaskAssignment.objects.filter(developer=user).values("task_id"),
        )
    return qs


def is_assignee(user, task):
    assignments = getattr(task, "_prefetched_objects_cache", {}).get("assignments")
    if assignments is not None:
        return any(assignment.developer_id == user.pk for assignment in assignments)
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
