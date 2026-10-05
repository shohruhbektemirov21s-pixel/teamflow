"""Vazifa biznes amallari. Holat o'tishi faqat `workflow.check_task_transition` orqali."""
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Max
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied

from apps.accounts.models import Role
from apps.core.api_utils import ServiceError
from apps.core.services import log
from apps.notifications.models import Notification
from apps.notifications.services import managers, notify
from apps.projects.services import create_project, ensure_members

from .models import (
    SubTask,
    Submission,
    SubmissionFile,
    Task,
    TaskAssignment,
    TaskFile,
    TaskSubmitAck,
    TaskSubmitAttachment,
    WorkLog,
)
from .permissions import can_manage_assignees, can_manage_subtasks, can_work_on, is_assignee
from .workflow import check_task_transition

K = Notification.Kind
S = Task.Status


def _project_developers(project, ids, field="assignee_ids"):
    """Ijrochilar faqat shu loyiha jamoasidagi faol dasturchilar bo'lishi kerak."""
    ids = set(ids or [])
    if not ids:
        return []
    users = list(
        get_user_model().objects.select_for_update().filter(
            pk__in=ids, role=Role.DEVELOPER, is_active=True, project_memberships__project=project
        )
    )
    if len(users) != len(ids):
        raise ServiceError("Ijrochi loyiha jamoasida bo'lishi kerak. Avval uni loyihaga qo'shing.", field)
    return users


def _check_trip_availability(users, existing_ids=(), field="assignee_ids"):
    existing_ids = set(existing_ids)
    away = [u.full_name for u in users if u.pk not in existing_ids and u.is_on_business_trip]
    if away:
        raise ServiceError(f"Xizmat safaridagi xodimga qaytguncha yangi topshiriq biriktirib bo'lmaydi: {', '.join(away)}.", field)


def _any_developers(project, ids, field, existing_ids=()):
    """Vazifa oynasi: istalgan faol dasturchi tanlanadi; jamoada bo'lmasa, loyiha jamoasiga qo'shiladi."""
    ids = set(ids or [])
    users = list(get_user_model().objects.select_for_update().filter(pk__in=ids, role=Role.DEVELOPER, is_active=True))
    if len(users) != len(ids):
        raise ServiceError("Faqat faol dasturchilarni biriktirish mumkin.", field)
    _check_trip_availability(users, existing_ids, field)
    ensure_members(project, users)
    return users


def _check_times(starts_at, due_at):
    if starts_at and due_at and due_at < starts_at:
        raise ServiceError("Tugash vaqti boshlanish vaqtidan oldin bo'lishi mumkin emas.", "due_at")


def _reviewers(task):
    """Tekshiruv haqida kimga xabar boriladi: vazifani bergan menejer va loyiha egasi; bo'lmasa barcha menejerlar."""
    people = [u for u in (task.created_by, task.project.created_by) if u and u.is_manager]
    return people or list(managers())


@transaction.atomic
def create_task(user, project, *, title, description="", priority="medium", starts_at=None, due_at=None,
                assignee_ids=None, subtasks=None, files=None):
    """Menejer — istalgan jamoa a'zosiga. Dasturchi — faqat o'ziga, o'z loyihasida ("Mening ishim")."""
    if user.is_developer:
        if not project.memberships.filter(developer=user).exists():
            raise ServiceError("Siz bu loyiha jamoasida emassiz.")
        assignee_ids = [user.pk]
        subtasks = [dict(s, assignee_ids=[user.pk]) for s in (subtasks or [])]
    elif not user.is_manager:
        raise ServiceError("Topshiriq yaratishga ruxsatingiz yo'q.")
    if not title.strip():
        raise ServiceError("Topshiriq nomini yozing.", "title")
    _check_times(starts_at, due_at)
    assignees = _project_developers(project, assignee_ids)
    _check_trip_availability(assignees)
    if not assignees:
        raise ServiceError("Kamida bitta ijrochi tanlang.", "assignee_ids")

    task = Task.objects.create(
        project=project, title=title.strip(), description=description, priority=priority,
        starts_at=starts_at, due_at=due_at, created_by=user,
    )
    TaskAssignment.objects.bulk_create(TaskAssignment(task=task, developer=d) for d in assignees)
    _replace_subtasks(task, subtasks or [])
    for f in files or []:
        TaskFile.objects.create(task=task, file=f, original_name=f.name[:255], uploaded_by=user)

    notify(assignees, K.TASK_ASSIGNED, f"Sizga topshiriq berildi: {task.title}", task, exclude=user)
    log(user, "task_created", f"{user.full_name} topshiriq yaratdi: {task.title}", task)
    return task


def _replace_subtasks(task, items):
    """Formadan: sub-vazifalar qaytadan yoziladi, ijrochilar faqat loyiha jamoasidan."""
    items = [i for i in items if i.get("title", "").strip()]
    users = _project_developers(task.project, {pk for i in items for pk in i.get("assignee_ids") or []}, field="subtasks")
    by_id = {item.pk: item for item in task.subtasks.prefetch_related("assignees")}
    seen = set()
    for item in items:
        subtask_id = item.get("id")
        if subtask_id is not None and (subtask_id not in by_id or subtask_id in seen):
            raise ServiceError("Sub-vazifa bu topshiriqqa tegishli emas yoki takrorlangan.", "subtasks")
        seen.add(subtask_id)
        existing_ids = {u.pk for u in by_id[subtask_id].assignees.all()} if subtask_id is not None else set()
        selected = set(item.get("assignee_ids") or [])
        _check_trip_availability((u for u in users if u.pk in selected), existing_ids, "subtasks")
    task.subtasks.all().delete()
    for n, i in enumerate(items):
        subtask = SubTask.objects.create(task=task, title=i["title"].strip(), is_done=bool(i.get("is_done")), position=n)
        subtask.assignees.set(set(i.get("assignee_ids") or []))


@transaction.atomic
def create_bulk_tasks(user, project, items):
    """Bitta qator xato bo'lsa, butun taqsimlash bekor qilinadi."""
    created = []
    for index, item in enumerate(items, start=1):
        try:
            created.append(create_task(user, project, **item))
        except ServiceError as exc:
            raise ServiceError(f"{index}-topshiriq: {exc.detail}", "tasks") from exc
    return created


@transaction.atomic
def create_project_with_tasks(user, *, tasks, task_files, **project_data):
    """Loyiha yaratish oynasi: loyiha, jamoa va har bir xodimga alohida vazifalar (sana, fayl bilan).

    Bitta tranzaksiya — biror vazifada xato bo'lsa, loyiha ham yaratilmaydi (chala loyiha qolmaydi).
    Loyiha `projects.services` da yaratiladi; tasks yuqori qatlam bo'lgani uchun orkestratsiya shu yerda.
    """
    project = create_project(user, **project_data)
    for index, item in enumerate(tasks):
        item = dict(item)
        try:
            create_task(user, project, assignee_ids=[item.pop("assignee_id")], files=task_files.get(index, []), **item)
        except ServiceError as exc:
            raise ServiceError(f"{index + 1}-topshiriq: {exc.detail}", "tasks") from exc
    return project


@transaction.atomic
def update_task(task, user, *, assignee_ids=None, subtasks=None, **data):
    """Menejer: nom, izoh, muhimlik, vaqt, ijrochilar, sub-vazifalar."""
    if not user.is_manager:
        raise ServiceError("Topshiriqni faqat loyiha menejeri yoki boshliq tahrirlaydi.")
    if task.status == S.DONE:
        raise ServiceError("Bajarilgan topshiriq o'zgartirilmaydi.")
    for field in ("title", "description", "priority", "starts_at", "due_at"):
        if field in data:
            setattr(task, field, data[field])
    if not task.title.strip():
        raise ServiceError("Topshiriq nomini yozing.", "title")
    _check_times(task.starts_at, task.due_at)
    task.save()
    if assignee_ids is not None:
        _apply_assignees(task, user, _project_developers(task.project, assignee_ids))
    if subtasks is not None:
        _replace_subtasks(task, subtasks)
    log(user, "task_updated", f"{user.full_name} topshiriqni o'zgartirdi: {task.title}", task)
    return task


def _apply_assignees(task, user, new):
    """Ijrochilar ro'yxatini almashtiradi; yangi qo'shilganlarga bildirishnoma."""
    if not new:
        raise ServiceError("Kamida bitta ijrochi tanlang.", "assignee_ids")
    current = set(task.assignments.values_list("developer_id", flat=True))
    _check_trip_availability(new, current)
    task.assignments.exclude(developer_id__in=[d.pk for d in new]).delete()
    added = [d for d in new if d.pk not in current]
    TaskAssignment.objects.bulk_create(TaskAssignment(task=task, developer=d) for d in added)
    notify(added, K.TASK_ASSIGNED, f"Sizga topshiriq berildi: {task.title}", task, exclude=user)
    if task.submit_requested_at and current != {d.pk for d in new}:
        # Ijrochilar ro'yxati o'zgargach eski tekshiruvga-yuborish so'rovi eskirib qoladi (yangi ijrochi
        # so'rovsiz qolmasin) — bekor qilinadi, menejer qayta yuborganda hammadan yangidan so'raladi.
        _clear_submit_ack(task)
        task.save(update_fields=["submit_requested_at", "submit_requested_by", "pending_submit_note", "updated_at"])
    return added


@transaction.atomic
def set_task_assignees(task, user, assignee_ids):
    """Vazifa oynasidan ijrochilar: menejer yoki vazifani yaratgan dasturchi. Istalgan dasturchi tanlanadi
    (jamoada bo'lmasa, loyihaga qo'shiladi). Dasturchi o'zini olib tashlay olmaydi — vazifa undan yashirinib qoladi."""
    if not can_manage_assignees(user, task):
        raise ServiceError("Ijrochilarni faqat menejer yoki topshiriqni yaratgan dasturchi o'zgartiradi.")
    if task.status == S.DONE:
        raise ServiceError("Bajarilgan topshiriq o'zgartirilmaydi.")
    if user.is_developer and user.pk not in set(assignee_ids):
        raise ServiceError("O'zingizni ijrochilardan olib tashlay olmaysiz.", "assignee_ids")
    before = set(task.assignments.values_list("developer_id", flat=True))
    new = _any_developers(task.project, assignee_ids, "assignee_ids", before)
    _apply_assignees(task, user, new)
    if before != {d.pk for d in new}:
        names = ", ".join(d.full_name for d in new)
        log(user, "task_assignees", f"{user.full_name} topshiriq ijrochilarini o'zgartirdi: {names} ({task.title})", task)
    return task


@transaction.atomic
def delete_task(task, user):
    if not user.is_manager:
        raise ServiceError("Topshiriqni faqat loyiha menejeri yoki boshliq o'chiradi.")
    task = Task.objects.select_for_update().get(pk=task.pk)
    if task.archived_at is not None:
        raise ServiceError("Topshiriq allaqachon arxivlangan.")
    task.archived_at = timezone.now()
    task.save(update_fields=["archived_at", "updated_at"])
    log(user, "task_deleted", f"{user.full_name} topshiriqni arxivladi: {task.title}", task)


@transaction.atomic
def start_task(task, user):
    """Nazoratda → Jarayonda."""
    task = Task.objects.select_for_update().get(pk=task.pk)
    if not can_work_on(user, task):
        raise ServiceError("Bu topshiriq sizga biriktirilmagan.")
    check_task_transition(task.status, S.IN_PROGRESS, user.role)
    task.status = S.IN_PROGRESS
    task.save(update_fields=["status", "updated_at"])
    log(user, "task_started", f"{user.full_name} topshiriqni boshladi: {task.title}", task)
    return task


@transaction.atomic
def submit_task(task, user, *, note, files=None):
    """Jarayonda → Tekshiruvda.

    Vazifa ijrochisi (dasturchi) to'g'ridan-to'g'ri yuboradi. Menejer (PM/Boshliq) — ijrochi emasligi
    sababli — avval vazifaning barcha faol ijrochilaridan tasdiq so'raydi (`_request_submit_ack`);
    holat faqat hammasi "Ha" degandan keyin, oxirgi tasdiqlagan payt (`ack_submit`) o'zgaradi.
    """
    task = Task.objects.select_for_update().select_related("project__created_by", "created_by").get(pk=task.pk)
    if not can_work_on(user, task):
        raise ServiceError("Bu topshiriq sizga biriktirilmagan.")
    check_task_transition(task.status, S.IN_REVIEW, user.role)
    if not note.strip():
        raise ServiceError("Nima qilganingizni qisqacha yozing.", "note")

    if user.is_manager:
        if task.submit_requested_at is None:
            _request_submit_ack(task, user, note=note.strip(), files=files or [])
            return None
        if task.submit_acks.filter(confirmed__isnull=True).exists():
            raise ServiceError("Hali ijrochi tasdiqlamagan — javobini kutamiz.")
        # Hammasi tasdiqlagan (odatda `ack_submit` o'zi darhol yakunlaydi) — ehtiyot uchun shu yerda ham tozalanadi.
        _clear_submit_ack(task)
        task.save(update_fields=["submit_requested_at", "submit_requested_by", "pending_submit_note", "updated_at"])
    elif task.submit_requested_at is not None:
        # Ijrochi o'zi to'g'ridan-to'g'ri yubormoqchi — menejerning eski (hali javobsiz) so'rovi eskirgan,
        # bekor qilinadi (ijrochi hozir o'zi harakat qilyapti, tasdiq so'rashning hojati qolmadi).
        _clear_submit_ack(task)
        task.save(update_fields=["submit_requested_at", "submit_requested_by", "pending_submit_note", "updated_at"])

    return _create_submission(task, user, note=note.strip(), files=files or [])


def _create_submission(task, user, *, note, files):
    last_round = task.submissions.aggregate(m=Max("round"))["m"] or 0
    submission = Submission.objects.create(task=task, round=last_round + 1, submitted_by=user, note=note)
    for f in files:
        SubmissionFile.objects.create(submission=submission, file=f, original_name=f.name[:255])
    task.status = S.IN_REVIEW
    task.save(update_fields=["status", "updated_at"])
    notify(_reviewers(task), K.TASK_SUBMITTED, f"Tekshiruvga yuborildi: {task.title} ({user.full_name})", task,
           exclude=user)
    log(user, "task_submitted", f"{user.full_name} topshiriqni tekshiruvga yubordi: {task.title}", task)
    return submission


def _clear_submit_ack(task):
    task.submit_acks.all().delete()
    task.submit_attachments.all().delete()
    task.submit_requested_at = None
    task.submit_requested_by = None
    task.pending_submit_note = ""


def _request_submit_ack(task, user, *, note, files):
    """Menejer ijrochi bo'lmay yuborganda: holat o'zgarmaydi, vazifaning barcha faol ijrochilaridan
    tasdiq so'raladi. Eski (masalan rad etilgan) davr qoldig'i bo'lsa tozalanadi."""
    _clear_submit_ack(task)
    developers = list(task.assignees.all())
    task.pending_submit_note = note
    task.submit_requested_at = timezone.now()
    task.submit_requested_by = user
    task.save(update_fields=["pending_submit_note", "submit_requested_at", "submit_requested_by", "updated_at"])
    TaskSubmitAck.objects.bulk_create(TaskSubmitAck(task=task, developer=d) for d in developers)
    for f in files:
        TaskSubmitAttachment.objects.create(task=task, file=f, original_name=f.name[:255])
    notify(developers, K.TASK_SUBMIT_ACK_REQUESTED,
           f"Topshiriqni tekshiruvga yuborishga roziman? {task.title}", task, exclude=user)
    log(user, "task_submit_ack_requested",
        f"{user.full_name} topshiriqni tekshiruvga yuborishni ijrochidan so'radi: {task.title}", task)


@transaction.atomic
def ack_submit(task, user, *, confirmed, reason=""):
    """Ijrochi menejer so'ragan tekshiruvga yuborishni tasdiqlaydi yoki sabab bilan rad etadi.

    Birortasi rad etsa, butun so'rov davri bekor qilinadi — vazifa Jarayonda qoladi, menejer sababni
    ko'radi. Barcha ijrochilar tasdiqlasa, shu zahoti haqiqiy Submission yaratiladi va vazifa
    Tekshiruvdaga o'tadi (menejer qayta bosishi shart emas).
    """
    task = Task.objects.select_for_update().select_related(
        "project__created_by", "created_by", "submit_requested_by"
    ).get(pk=task.pk)
    try:
        ack = TaskSubmitAck.objects.select_for_update().get(task=task, developer=user)
    except TaskSubmitAck.DoesNotExist:
        raise PermissionDenied("Sizdan bu topshiriq uchun tekshiruvga yuborish tasdig'i so'ralmagan.")
    if ack.confirmed is not None:
        raise ServiceError("Siz bu so'rovga allaqachon javob bergansiz.")
    if not confirmed and not reason.strip():
        raise ServiceError("Sababini yozing — menejer nimani kutishini bilishi kerak.", "reason")

    ack.confirmed = confirmed
    ack.reason = reason.strip()
    ack.decided_at = timezone.now()
    ack.save(update_fields=["confirmed", "reason", "decided_at"])
    requester = task.submit_requested_by

    if not confirmed:
        _clear_submit_ack(task)
        task.save(update_fields=["submit_requested_at", "submit_requested_by", "pending_submit_note", "updated_at"])
        if requester:
            notify([requester], K.TASK_SUBMIT_ACK_REJECTED,
                   f"{user.full_name} tekshiruvga yuborishni rad etdi: {ack.reason} ({task.title})", task,
                   exclude=user)
        log(user, "task_submit_ack_rejected",
            f"{user.full_name} tekshiruvga yuborishni rad etdi: {ack.reason} ({task.title})", task)
        return task

    log(user, "task_submit_ack_confirmed",
        f"{user.full_name} tekshiruvga yuborishni tasdiqladi: {task.title}", task)
    if task.submit_acks.filter(confirmed__isnull=True).exists():
        return task

    note = task.pending_submit_note
    attachments = list(task.submit_attachments.all())
    submitted_by = requester or task.created_by
    last_round = task.submissions.aggregate(m=Max("round"))["m"] or 0
    submission = Submission.objects.create(task=task, round=last_round + 1, submitted_by=submitted_by, note=note)
    for a in attachments:
        SubmissionFile.objects.create(submission=submission, file=a.file.name, original_name=a.original_name)
    _clear_submit_ack(task)
    task.status = S.IN_REVIEW
    task.save(update_fields=["status", "submit_requested_at", "submit_requested_by", "pending_submit_note", "updated_at"])
    notify(_reviewers(task), K.TASK_SUBMITTED, f"Tekshiruvga yuborildi: {task.title} ({submitted_by.full_name})",
           task, exclude=user)
    log(submitted_by, "task_submitted", f"{submitted_by.full_name} topshiriqni tekshiruvga yubordi: {task.title}", task)
    return task


@transaction.atomic
def review_task(task, user, *, decision, note=""):
    """Tekshiruvda → Bajarildi (qabul) yoki → Jarayonda (qaytarish, izoh majburiy)."""
    task = Task.objects.select_for_update().get(pk=task.pk)
    target = S.DONE if decision == "accept" else S.IN_PROGRESS
    check_task_transition(task.status, target, user.role)
    if decision != "accept" and not note.strip():
        raise ServiceError("Qaytarish sababini yozing — dasturchi nimani tuzatishni bilishi kerak.", "note")
    submission = task.submissions.filter(decision=Submission.Decision.PENDING).order_by("-round").first()
    now = timezone.now()
    if submission:
        submission.decision = Submission.Decision.ACCEPTED if decision == "accept" else Submission.Decision.RETURNED
        submission.reviewed_by = user
        submission.review_note = note.strip()
        submission.reviewed_at = now
        submission.save()
    task.status = target
    task.completed_at = now if target == S.DONE else None
    task.save(update_fields=["status", "completed_at", "updated_at"])
    assignees = list(task.assignees.all())
    if target == S.DONE:
        notify(assignees, K.TASK_ACCEPTED, f"Topshiriq qabul qilindi: {task.title}", task, exclude=user)
        log(user, "task_accepted", f"{user.full_name} topshiriqni qabul qildi: {task.title}", task)
    else:
        notify(assignees, K.TASK_RETURNED, f"Topshiriq qaytarildi: {task.title}", task, exclude=user)
        log(user, "task_returned", f"{user.full_name} topshiriqni qaytardi: {task.title}", task)
    return task


def toggle_subtask(subtask, user, is_done):
    """Sub-vazifani belgilash: menejer, vazifa ijrochisi yoki sub-vazifa egasi."""
    task = subtask.task
    if not (user.is_manager or subtask.assignees.filter(pk=user.pk).exists() or is_assignee(user, task)):
        raise ServiceError("Bu sub-vazifa sizga tegishli emas.")
    if task.status == S.DONE:
        raise ServiceError("Bajarilgan topshiriq o'zgartirilmaydi.")
    subtask.is_done = is_done
    subtask.save(update_fields=["is_done"])
    return subtask


@transaction.atomic
def add_subtask(task, user, *, title, assignee_ids=()):
    """Sub-vazifa qo'shish. Ijrochilar — istalgan dasturchilar (jamoada bo'lmasa, loyihaga qo'shiladi)."""
    if not can_manage_subtasks(user, task):
        raise ServiceError("Topshiriqqa sub-vazifa qo'shish uchun ruxsatingiz yo'q.")
    if task.status == S.DONE:
        raise ServiceError("Bajarilgan topshiriqqa sub-vazifa qo'shib bo'lmaydi.")
    if not title.strip():
        raise ServiceError("Sub-vazifa nomini yozing.", "title")
    assignees = _any_developers(task.project, assignee_ids, "assignee_ids")

    last_pos = task.subtasks.aggregate(m=Max("position"))["m"] or 0
    subtask = SubTask.objects.create(task=task, title=title.strip(), is_done=False, position=last_pos + 1)
    subtask.assignees.set(assignees)
    _notify_subtask(subtask, user, assignees)
    log(user, "subtask_created", f"{user.full_name} sub-vazifa qo'shdi: {subtask.title}", task)
    return subtask


@transaction.atomic
def set_subtask_assignees(task, user, subtask_id, assignee_ids):
    """Mavjud sub-vazifaga ijrochi qo'shish yoki olib tashlash (bo'sh ro'yxat — ijrochisiz)."""
    if not can_manage_subtasks(user, task):
        raise ServiceError("Sub-vazifa ijrochilarini o'zgartirishga ruxsatingiz yo'q.")
    if task.status == S.DONE:
        raise ServiceError("Bajarilgan topshiriq o'zgartirilmaydi.")
    subtask = SubTask.objects.filter(pk=subtask_id, task=task).first()
    if not subtask:
        raise ServiceError("Sub-vazifa topilmadi.")
    current = set(subtask.assignees.values_list("pk", flat=True))
    assignees = _any_developers(task.project, assignee_ids, "assignee_ids", current)
    subtask.assignees.set(assignees)
    _notify_subtask(subtask, user, [d for d in assignees if d.pk not in current])
    log(user, "subtask_assignees", f"{user.full_name} sub-vazifa ijrochilarini o'zgartirdi: {subtask.title}", task)
    return subtask


def _notify_subtask(subtask, user, people):
    notify(people, K.TASK_ASSIGNED, f"Sizga sub-vazifa biriktirildi: {subtask.title} ({subtask.task.title})",
           subtask.task, exclude=user)


def delete_subtask(task, user, subtask_id):
    """Sub-vazifani o'chirish: menejer yoki vazifa ijrochisi."""
    if not can_manage_subtasks(user, task):
        raise ServiceError("Sub-vazifani o'chirishga ruxsatingiz yo'q.")
    if task.status == S.DONE:
        raise ServiceError("Bajarilgan topshiriq o'zgartirilmaydi.")
    subtask = SubTask.objects.filter(pk=subtask_id, task=task).first()
    if not subtask:
        raise ServiceError("Sub-vazifa topilmadi.")
    title = subtask.title
    subtask.delete()
    log(user, "subtask_deleted", f"{user.full_name} sub-vazifani o'chirdi: {title}", task)
    return True


def add_task_files(task, user, files):
    if not can_work_on(user, task):
        raise ServiceError("Bu topshiriqqa fayl qo'sha olmaysiz.")
    if task.status == S.DONE:
        raise ServiceError("Bajarilgan topshiriq o'zgartirilmaydi.")
    return [TaskFile.objects.create(task=task, file=f, original_name=f.name[:255], uploaded_by=user) for f in files]


@transaction.atomic
def log_work(task, user, **data):
    if not can_work_on(user, task):
        raise ServiceError("Bu topshiriq sizga biriktirilmagan.")
    if task.status == S.DONE:
        raise ServiceError("Bajarilgan topshiriqqa ish qayd qilib bo'lmaydi.")
    entry = WorkLog.objects.create(task=task, author=user, **data)
    log(user, "work_logged", f"{user.full_name} ish qayd etdi: {task.title} ({entry.hours} soat)", task)
    return entry


@transaction.atomic
def delete_worklog(entry, user):
    from rest_framework.exceptions import PermissionDenied
    if not (user.is_manager or entry.author_id == user.pk):
        raise PermissionDenied("Faqat o'zingizning yozuvingizni o'chira olasiz.")
    if entry.task.status == S.DONE:
        raise ServiceError("Bajarilgan topshiriqning ish jurnali o'zgartirilmaydi.")
    log(user, "worklog_deleted", f"{user.full_name} ish jurnali yozuvini o'chirdi: {entry.task.title}", entry.task)
    entry.delete()
