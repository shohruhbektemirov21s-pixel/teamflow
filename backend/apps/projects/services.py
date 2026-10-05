"""Loyiha biznes amallari. Faqat PM va Boshliq (yakunlashni tasdiqlash — boshqarma)."""
from django.apps import apps
from django.contrib.auth import get_user_model
from django.db import transaction
from rest_framework.exceptions import PermissionDenied

from apps.accounts.models import Role
from apps.core.api_utils import ServiceError
from apps.core.services import log
from apps.notifications.models import Notification
from apps.notifications.services import notify
from apps.orders.models import Order
from apps.orders.workflow import check_order_transition

from .models import Project, ProjectFile, ProjectMember
from .workflow import check_project_transition

K = Notification.Kind
S = Project.Stage


def _require_manager(user):
    if not user.is_manager:
        raise ServiceError("Loyihani faqat loyiha menejeri yoki boshliq boshqaradi.")


def _check_dates(start_date, end_date):
    if end_date < start_date:
        raise ServiceError("Tugash sanasi boshlanish sanasidan oldin bo'lishi mumkin emas.", "end_date")


def _developers(ids):
    ids = set(ids or [])
    users = list(get_user_model().objects.filter(pk__in=ids, role=Role.DEVELOPER, is_active=True))
    if len(users) != len(ids):
        raise ServiceError("Faqat faol dasturchilarni biriktirish mumkin.", "member_ids")
    return users


@transaction.atomic
def create_project(user, *, code, name="", description="", start_date=None, end_date=None,
                   member_ids=None, files=None, order=None, stage=Project.Stage.PLANNED):
    """Qo'lda yoki tasdiqlangan buyurtmadan loyiha yaratadi.

    Buyurtmadan: nom, izoh va TZ fayli buyurtmadan olinadi; sanalar — PM tasdiqlaganda kiritganlari
    (formadan kelgan sana bo'lsa, u ustun). Loyiha raqami (`code`) har doim qo'lda kiritiladi —
    buyurtmadan olinmaydi, chunki buyurtmada bunday raqam yo'q.
    """
    _require_manager(user)
    if stage == S.PENDING_APPROVAL:
        raise ServiceError("Bu daraja to'g'ridan-to'g'ri tanlanmaydi.", "stage")
    if order is not None:
        order = Order.objects.select_for_update().get(pk=order.pk)
        check_order_transition(order.status, Order.Status.PROJECT_CREATED, user.role)
        name = order.title
        description = order.description
        start_date = start_date or order.start_date
        end_date = end_date or order.end_date
    if not name.strip():
        raise ServiceError("Loyiha nomini yozing.", "name")
    if not start_date or not end_date:
        raise ServiceError("Boshlanish va tugash sanasini kiriting.")
    _check_dates(start_date, end_date)
    if Project.objects.filter(code=code).exists():
        raise ServiceError("Bu loyiha raqami band — boshqasini kiriting.", "code")

    project = Project.objects.create(
        code=code, name=name.strip(), description=description, start_date=start_date, end_date=end_date,
        stage=S.PLANNED if order is not None and stage == S.DONE else stage,
        order=order, created_by=user,
    )
    ProjectMember.objects.bulk_create(ProjectMember(project=project, developer=d) for d in _developers(member_ids))

    if order is not None:
        # Buyurtmaning tasdiqlangan TZ fayli loyihaga ulanadi (fayl nusxalanmaydi — bir xil saqlangan fayl).
        version = order.latest_version
        ProjectFile.objects.create(project=project, file=version.file.name,
                                   original_name=version.original_name, uploaded_by=version.uploaded_by)
        order.status = Order.Status.PROJECT_CREATED
        if (order.start_date, order.end_date) != (start_date, end_date):
            order.start_date, order.end_date = start_date, end_date
        order.save()

    for f in files or []:
        ProjectFile.objects.create(project=project, file=f, original_name=f.name[:255], uploaded_by=user)

    if order is not None and stage == S.DONE:
        _apply_stage(project, user, stage)
        project.save(update_fields=["stage", "updated_at"])

    log(user, "project_created", f"{user.full_name} loyiha yaratdi: {project.name}", project)
    return project


@transaction.atomic
def update_project(project, user, **data):
    """PM/Boshliq loyihani tahrirlaydi: nom, izoh, sana, daraja. Buyurtmadan yaratilgan bo'lsa,
    nom/izoh/sana o'zgarishi bog'liq buyurtmaga ham ko'chadi (ikkalasi bitta TZ ma'lumotini ko'rsatadi).
    Daraja — `_apply_stage` orqali (yakunlashda boshqarma tasdig'i talab qilinishi mumkin)."""
    _require_manager(user)
    stage = data.pop("stage", None)
    info_changed = any(data.get(f) is not None for f in ("name", "description", "start_date", "end_date"))
    for field in ("name", "description", "start_date", "end_date"):
        if data.get(field) is not None:
            setattr(project, field, data[field])
    if not project.name.strip():
        raise ServiceError("Loyiha nomini yozing.", "name")
    _check_dates(project.start_date, project.end_date)
    if stage is not None:
        _apply_stage(project, user, stage)
    project.save()
    if project.order_id and info_changed:
        order_fields = {}
        if data.get("name") is not None:
            order_fields["title"] = project.name
        if data.get("description") is not None:
            order_fields["description"] = project.description
        if data.get("start_date"):
            order_fields["start_date"] = project.start_date
        if data.get("end_date"):
            order_fields["end_date"] = project.end_date
        if order_fields:
            Order.objects.filter(pk=project.order_id).update(**order_fields)
    if info_changed:
        log(user, "project_updated", f"{user.full_name} loyihani o'zgartirdi: {project.name}", project)
    return project


def _apply_stage(project, user, stage):
    """Daraja o'tishi (xotirada, `project.save()` chaqiruvchida bajariladi).

    Buyurtmasiz loyihada "Yakunlangan" to'g'ridan-to'g'ri qo'yiladi. Buyurtmadan yaratilgan loyihada
    "Yakunlangan" tanlansa, avval "Tasdiqlash kutilmoqda" ga o'tadi va buyurtmani yuborgan boshqarmaga
    bildirishnoma boradi — faqat o'sha boshqarma uni "Yakunlangan" yoki "Tuzatish kerak" qila oladi
    (`confirm_completion` / `reject_completion`).
    """
    if stage == S.PENDING_APPROVAL:
        raise ServiceError("Bu daraja to'g'ridan-to'g'ri tanlanmaydi.", "stage")
    target = S.PENDING_APPROVAL if stage == S.DONE and project.order_id else stage
    check_project_transition(project.stage, target, user.role)
    project.stage = target
    if target == S.PENDING_APPROVAL:
        notify([project.order.submitted_by], K.PROJECT_COMPLETION_REQUESTED,
               f"Loyiha yakunlanishini tasdiqlang: {project.name}", project.order, exclude=user)
        log(user, "project_completion_requested",
            f"{user.full_name} loyiha yakunlanishini boshqarmadan so'radi: {project.name}", project)
    else:
        log(user, "project_stage",
            f"{user.full_name} loyiha darajasini o'zgartirdi: {project.get_stage_display()} ({project.name})", project)


@transaction.atomic
def confirm_completion(project, user):
    """Boshqarma loyiha yakunlanishini tasdiqlaydi — faqat buyurtmani yuborgan boshqarma."""
    if not (user.is_department and project.order_id and project.order.submitted_by_id == user.pk):
        raise PermissionDenied("Bu amal faqat buyurtmani yuborgan boshqarma uchun.")
    check_project_transition(project.stage, S.DONE, user.role)
    project.stage = S.DONE
    project.save(update_fields=["stage", "updated_at"])
    notify([project.created_by], K.PROJECT_COMPLETION_APPROVED,
           f"Loyiha yakunlanishi tasdiqlandi: {project.name}", project, exclude=user)
    log(user, "project_completion_approved",
        f"{user.full_name} ({user.department_name}) loyiha yakunlanishini tasdiqladi: {project.name}", project)
    return project


@transaction.atomic
def reject_completion(project, user, *, reason):
    """Boshqarma kamchilik topsa rad etadi (sabab majburiy) — loyiha "Tuzatish kerak" ga qaytadi,
    menejer sababni ko'rib tuzatib, yana yakunlashni so'rashi mumkin."""
    if not (user.is_department and project.order_id and project.order.submitted_by_id == user.pk):
        raise PermissionDenied("Bu amal faqat buyurtmani yuborgan boshqarma uchun.")
    if not reason.strip():
        raise ServiceError("Sababini yozing — menejer nimani tuzatishni bilishi kerak.", "reason")
    check_project_transition(project.stage, S.NEEDS_FIX, user.role)
    project.stage = S.NEEDS_FIX
    project.save(update_fields=["stage", "updated_at"])
    notify([project.created_by], K.PROJECT_COMPLETION_REJECTED,
           f"Loyiha yakunlanishi rad etildi: {project.name} — {reason.strip()}", project, exclude=user)
    log(user, "project_completion_rejected",
        f"{user.full_name} ({user.department_name}) loyiha yakunlanishini rad etdi: {reason.strip()} ({project.name})",
        project)
    return project


@transaction.atomic
def set_members(project, user, member_ids):
    """Jamoani yangilaydi. Chiqarilgan dasturchi shu loyihaning tugallanmagan vazifalari va sub-vazifalaridan ham
    olib tashlanadi (loyihani ko'rmay turib vazifasi qolmasin). Bajarilgan vazifalar tarix sifatida qoladi.
    Faol vazifaning yagona ijrochisini chiqarib bo'lmaydi — vazifa ijrochisiz qolmasligi uchun."""
    _require_manager(user)
    wanted = {d.pk: d for d in _developers(member_ids)}
    current = set(project.memberships.values_list("developer_id", flat=True))
    removed = current - set(wanted)
    if removed:
        _release_developers(project, removed)
    project.memberships.exclude(developer_id__in=wanted).delete()
    ProjectMember.objects.bulk_create(
        ProjectMember(project=project, developer=d) for pk, d in wanted.items() if pk not in current
    )
    log(user, "project_members", f"{user.full_name} loyiha jamoasini o'zgartirdi: {project.name}", project)
    return project


def _release_developers(project, developer_ids):
    # tasks app projects'dan yuqorida turadi (ARCHITECTURE 3-bo'lim), shuning uchun tasks modellari
    # import qilinmaydi — teskari bog'lanish va `apps.get_model` orqali olinadi.
    open_tasks = project.tasks.filter(archived_at__isnull=True).exclude(status="done")
    blocked = [
        task for task in open_tasks.filter(assignments__developer_id__in=developer_ids)
        .prefetch_related("assignments__developer").distinct()
        if all(a.developer_id in developer_ids for a in task.assignments.all())
    ]
    if blocked:
        names = ", ".join(sorted({a.developer.full_name for t in blocked for a in t.assignments.all()}))
        codes = ", ".join(t.code for t in blocked)
        raise ServiceError(
            f"{names} — {codes} vazifasining yagona ijrochisi. Avval bu vazifani boshqa xodimga bering.",
            "member_ids",
        )
    open_ids = open_tasks.values("pk")
    apps.get_model("tasks", "TaskAssignment").objects.filter(task__in=open_ids, developer_id__in=developer_ids).delete()
    apps.get_model("tasks", "SubTask").assignees.through.objects.filter(
        subtask__task__in=open_ids, user_id__in=developer_ids
    ).delete()


def ensure_members(project, developers):
    """Vazifa oynasida jamoadan tashqari dasturchi tanlansa — u loyiha jamoasiga qo'shiladi.
    Ruxsat chaqiruvchi xizmatda (tasks.services) tekshiriladi. Qo'shilganlar ro'yxati qaytadi."""
    current = set(project.memberships.values_list("developer_id", flat=True))
    added = [d for d in developers if d.pk not in current]
    ProjectMember.objects.bulk_create(ProjectMember(project=project, developer=d) for d in added)
    return added


def add_files(project, user, files):
    _require_manager(user)
    created = [
        ProjectFile.objects.create(project=project, file=f, original_name=f.name[:255], uploaded_by=user)
        for f in files
    ]
    log(user, "project_files", f"{user.full_name} loyihaga {len(created)} ta fayl qo'shdi: {project.name}", project)
    return created


def delete_file(project, user, file_id):
    _require_manager(user)
    deleted, _ = project.files.filter(pk=file_id).delete()
    if not deleted:
        raise ServiceError("Fayl topilmadi.")
