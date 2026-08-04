"""Loyiha biznes amallari. Faqat PM va Boshliq."""
from django.contrib.auth import get_user_model
from django.db import transaction

from apps.accounts.models import Role
from apps.core.api_utils import ServiceError
from apps.core.services import log
from apps.orders.models import Order
from apps.orders.workflow import check_order_transition

from .models import Project, ProjectFile, ProjectMember


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
def create_project(user, *, name="", description="", start_date=None, end_date=None,
                   member_ids=None, files=None, order=None, stage=Project.Stage.PLANNED):
    """Qo'lda yoki tasdiqlangan buyurtmadan loyiha yaratadi.

    Buyurtmadan: nom, izoh va TZ fayli buyurtmadan olinadi; sanalar — PM tasdiqlaganda kiritganlari
    (formadan kelgan sana bo'lsa, u ustun).
    """
    _require_manager(user)
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

    project = Project.objects.create(
        name=name.strip(), description=description, start_date=start_date, end_date=end_date,
        stage=stage, order=order, created_by=user,
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

    log(user, "project_created", f"{user.full_name} loyiha yaratdi: {project.name}", project)
    return project


@transaction.atomic
def update_project(project, user, **data):
    """Buyurtmadan yaratilgan loyihada faqat sanalar (va daraja) o'zgaradi."""
    _require_manager(user)
    if project.order_id:
        forbidden = {"name", "description"} & {k for k, v in data.items() if v is not None}
        if forbidden:
            raise ServiceError("Buyurtmadan yaratilgan loyihada faqat sanalarni o'zgartirish mumkin.")
    for field in ("name", "description", "start_date", "end_date", "stage"):
        if data.get(field) is not None:
            setattr(project, field, data[field])
    if not project.name.strip():
        raise ServiceError("Loyiha nomini yozing.", "name")
    _check_dates(project.start_date, project.end_date)
    project.save()
    if project.order_id and (data.get("start_date") or data.get("end_date")):
        Order.objects.filter(pk=project.order_id).update(start_date=project.start_date, end_date=project.end_date)
    log(user, "project_updated", f"{user.full_name} loyihani o'zgartirdi: {project.name}", project)
    return project


@transaction.atomic
def set_members(project, user, member_ids):
    _require_manager(user)
    wanted = {d.pk: d for d in _developers(member_ids)}
    current = set(project.memberships.values_list("developer_id", flat=True))
    project.memberships.exclude(developer_id__in=wanted).delete()
    ProjectMember.objects.bulk_create(
        ProjectMember(project=project, developer=d) for pk, d in wanted.items() if pk not in current
    )
    log(user, "project_members", f"{user.full_name} loyiha jamoasini o'zgartirdi: {project.name}", project)
    return project


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
