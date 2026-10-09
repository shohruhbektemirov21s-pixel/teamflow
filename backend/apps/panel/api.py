"""Yig'uvchi API: bosh panel, xodimlar, qidiruv, izohlar, umumiy tarix, fayllar."""
import mimetypes

from django.conf import settings
from django.contrib.contenttypes.models import ContentType
from django.db.models import Count, F, Q, Window
from django.db.models.functions import RowNumber
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from apps.accounts.models import Role, User
from apps.accounts.serializers import SELF_REGISTER_ROLES
from apps.core.choices import Priority
from apps.core.api_utils import avatar_url, require_manager, user_brief
from apps.core.codes import resolve_code
from apps.core.pagination import BoundedPagination, bounded_unpaged
from apps.core.models import ActivityLog, Comment
from apps.core.services import log
from apps.notifications.models import Notification
from apps.notifications.services import notify
from apps.orders.filters import department_dashboard
from apps.orders.models import Order, OrderVersion
from apps.orders.permissions import can_view_order, visible_orders
from apps.portfolio.models import ProjectType as PortfolioProjectType
from apps.projects.models import Project, ProjectFile
from apps.projects.permissions import can_view_project, visible_projects
from apps.tasks.filters import ACTIVE, dashboard_counts
from apps.tasks.models import SubmissionFile, Task, TaskFile
from apps.tasks import workflow as task_workflow
from apps.tasks.permissions import listed_tasks, visible_tasks

# ─── Ma'lumotnomalar (frontend ro'yxat va nomlarni shu yerdan oladi) ──────────


def _choices(enum):
    return [{"value": value, "label": str(label)} for value, label in enum.choices]


@api_view(["GET"])
@permission_classes([AllowAny])
def meta(request):
    """Barcha tanlov ro'yxatlari — yagona manba Django modellari va holat jadvallari.

    `task_moves` — joriy foydalanuvchi roli uchun ruxsat etilgan vazifa o'tishlari (tasks/workflow.py).
    Ro'yxatdan o'tish sahifasi ham ishlatgani uchun kirmagan foydalanuvchiga ham ochiq.
    """
    user = request.user
    role = user.role if user.is_authenticated else None
    moves = [
        {"from": source, "to": target}
        for (source, target), roles in task_workflow.TRANSITIONS.items()
        if role in roles
    ]
    return Response({
        "roles": _choices(Role),
        "register_roles": [r for r in _choices(Role) if r["value"] in SELF_REGISTER_ROLES],
        "priorities": _choices(Priority),
        "task_statuses": _choices(Task.Status),
        "order_statuses": _choices(Order.Status),
        "project_stages": _choices(Project.Stage),
        "portfolio_project_types": _choices(PortfolioProjectType),
        "task_moves": moves,
        # Bot ulangan bo'lsagina havola beriladi (token bo'lmasa bot javob bermaydi)
        "telegram_bot": settings.TELEGRAM_BOT_USERNAME if settings.TELEGRAM_BOT_TOKEN else "",
    })


# ─── Bosh panel ──────────────────────────────────────────────────────────────


@api_view(["GET"])
def dashboard(request):
    """Karta sonlari. Dasturchi — faqat o'ziga biriktirilganlar, menejer — hammasi."""
    user = request.user
    if user.is_department:
        return Response(department_dashboard(visible_orders(user)))
    data = dashboard_counts(listed_tasks(user))
    if user.is_manager:
        data["orders_pending"] = Order.objects.filter(status=Order.Status.SUBMITTED).count()
    return Response(data)


def _people_counts(qs):
    now = timezone.now()
    return qs.select_related("specialty").annotate(
        active_tasks=Count("assigned_tasks", filter=Q(assigned_tasks__status__in=ACTIVE, assigned_tasks__archived_at__isnull=True), distinct=True),
        overdue_tasks=Count("assigned_tasks", filter=Q(assigned_tasks__status__in=ACTIVE, assigned_tasks__due_at__lt=now, assigned_tasks__archived_at__isnull=True), distinct=True),
        review_tasks=Count("assigned_tasks", filter=Q(assigned_tasks__status="in_review", assigned_tasks__archived_at__isnull=True), distinct=True),
        done_tasks=Count("assigned_tasks", filter=Q(assigned_tasks__status="done", assigned_tasks__archived_at__isnull=True), distinct=True),
    )


def _people_rows(qs):
    """Xodim qatorlari (ro'yxat va bitta xodim oynasi uchun bir xil shakl): bandlik sonlari va hozirgi ishi.

    Sonlar, faol ishlar va loyihalar guruhlab olinadi (xodim soniga bog'liq N+1 yo'q).
    """
    now = timezone.now()
    users = list(_people_counts(qs)) if hasattr(qs, "annotate") else list(qs)
    doing, work, projects = {}, {}, {}
    from apps.tasks.models import TaskAssignment
    assignments = TaskAssignment.objects.filter(developer__in=users, task__status__in=ACTIVE,
                                                task__archived_at__isnull=True)
    def previews(queryset):
        return queryset.select_related("task__project").annotate(_rank=Window(
            expression=RowNumber(), partition_by=[F("developer_id")],
            order_by=[F("task__due_at").asc(nulls_last=True), F("task_id").asc()],
        )).filter(_rank__lte=3).order_by("developer_id", "_rank")
    for assignment in previews(assignments):
        task = assignment.task
        work.setdefault(assignment.developer_id, []).append({
                "id": task.pk, "title": task.title, "status": task.status,
                "due_at": task.due_at, "is_overdue": bool(task.due_at and task.due_at < now),
                "project": {"id": task.project_id, "name": task.project.name, "code": task.project.code},
            })
    for assignment in previews(assignments.filter(task__status=Task.Status.IN_PROGRESS)):
        doing.setdefault(assignment.developer_id, []).append({"id": assignment.task_id, "title": assignment.task.title})
    user_ids = {u.pk for u in users}
    for project in Project.objects.filter(
        Q(members__in=users) | Q(created_by__in=users) | Q(order__approved_by__in=users)
    ).distinct().select_related("order").prefetch_related("members"):
        owners = {u.pk for u in project.members.all()} | {project.created_by_id}
        if project.order_id and project.order.approved_by_id:
            owners.add(project.order.approved_by_id)
        for uid in owners & user_ids:
            projects.setdefault(uid, []).append({
                "id": project.pk, "name": project.name, "code": project.code,
                "stage": project.stage, "end_date": project.end_date,
            })
    return [
        {
            "id": u.pk, "full_name": u.full_name, "role": u.role, "role_label": u.get_role_display(),
            "specialty": u.specialty.name if u.specialty else "", "department_name": u.department_name,
            "responsibilities": u.responsibilities,
            "avatar": avatar_url(u), "active_tasks": u.active_tasks, "overdue_tasks": u.overdue_tasks,
            "business_trip_return_date": u.business_trip_return_date, "is_on_business_trip": u.is_on_business_trip,
            "review_tasks": u.review_tasks, "done_tasks": u.done_tasks,
            "doing": doing.get(u.pk, [])[:3],
            "work": work.get(u.pk, [])[:3], "projects": projects.get(u.pk, []),
        }
        for u in users
    ]


@api_view(["GET"])
def people(request):
    """Xodimlar va band-bo'shligi. PM — dasturchilar; Boshliq — hamma xodimlar. Vazifasi yo'qlar tepada."""
    require_manager(request.user)
    qs = User.objects.filter(is_active=True).exclude(role="")
    if request.user.is_boss:
        if request.query_params.get("role"):
            qs = qs.filter(role=request.query_params["role"])
    else:
        qs = qs.filter(role=Role.DEVELOPER)
    q = request.query_params.get("q", "").strip()[:200]
    if q:
        matches = qs.filter(Q(first_name__icontains=q) | Q(last_name__icontains=q) | Q(specialty__name__icontains=q)
                       | Q(department_name__icontains=q) | Q(responsibilities__icontains=q)
                       | Q(project_memberships__project__name__icontains=q)
                       | Q(project_memberships__project__code__icontains=q)
                       | Q(assigned_tasks__title__icontains=q) | Q(assigned_tasks__project__name__icontains=q)
                       | Q(assigned_tasks__project__code__icontains=q)).distinct()
        qs = qs.filter(pk__in=matches.values("pk"))
    qs = _people_counts(qs)
    if request.query_params.get("free") == "1":
        qs = qs.filter(role=Role.DEVELOPER, active_tasks=0).filter(
            Q(business_trip_return_date__isnull=True) | Q(business_trip_return_date__lt=timezone.localdate()))
    qs = qs.order_by("active_tasks", "first_name", "last_name", "pk")
    if request.query_params.get("paginated") == "1":
        paginator = BoundedPagination()
        page = paginator.paginate_queryset(qs, request)
        return paginator.get_paginated_response(_people_rows(page))
    return Response(_people_rows(bounded_unpaged(qs)))


# ─── Qidiruv (Ctrl K) ────────────────────────────────────────────────────────


@api_view(["GET"])
def search(request):
    q = request.query_params.get("q", "").strip()
    user = request.user
    empty = {"tasks": [], "projects": [], "orders": [], "people": []}
    if len(q) < 2:
        return Response(empty)
    code = resolve_code(q)
    if code:
        # Kod yozilsa (9 xonali raqam) — faqat aynan shu yozuv, ko'rish huquqi bo'lsa
        kind, pk = code
        if kind == "task":
            return Response({**empty, "tasks": _search_tasks(listed_tasks(user).filter(pk=pk))})
        return Response({**empty, "projects": _search_projects(visible_projects(user).filter(pk=pk))})
    tasks = listed_tasks(user).filter(Q(title__icontains=q) | Q(description__icontains=q))[:6]
    projects = visible_projects(user).filter(name__icontains=q)[:6]
    orders = visible_orders(user).filter(Q(title__icontains=q) | Q(submitted_by__department_name__icontains=q))[:6]
    people = []
    if user.is_manager:
        people = [
            {"id": u.pk, "full_name": u.full_name, "role_label": u.get_role_display()}
            for u in User.objects.filter(is_active=True).exclude(role="").filter(
                Q(first_name__icontains=q) | Q(last_name__icontains=q) | Q(department_name__icontains=q)
            )[:6]
        ]
    return Response({
        "tasks": _search_tasks(tasks),
        "projects": _search_projects(projects),
        "orders": [{"id": o.pk, "title": o.title, "status": o.status} for o in orders],
        "people": people,
    })


def _search_tasks(tasks):
    return [{"id": t.pk, "code": t.code, "title": t.title, "status": t.status, "project": t.project.name}
            for t in tasks]


def _search_projects(projects):
    return [{"id": p.pk, "code": p.code, "name": p.name, "stage": p.stage} for p in projects]


# ─── Izohlar ─────────────────────────────────────────────────────────────────

TARGETS = {"order": Order, "project": Project, "task": Task}


def _resolve_target(user, target_type, target_id):
    """Izoh nishoni va unga kirish huquqi. Ko'rish huquqi bo'lmasa — 404 (mavjudligi oshkor qilinmaydi)."""
    model = TARGETS.get(target_type)
    if model is None:
        raise Http404
    if model is Order:
        obj = get_object_or_404(Order, pk=target_id)
        ok = can_view_order(user, obj)
    elif model is Project:
        obj = get_object_or_404(Project, pk=target_id)
        ok = can_view_project(user, obj)
    else:
        obj = get_object_or_404(visible_tasks(user), pk=target_id)
        ok = True
    if not ok:
        raise Http404
    return obj


def _participants(obj):
    if isinstance(obj, Order):
        return [obj.submitted_by, obj.approved_by]
    if isinstance(obj, Project):
        return [obj.created_by, *[m.developer for m in obj.memberships.select_related("developer")]]
    return [obj.created_by, *obj.assignees.all()]


class CommentInput(serializers.Serializer):
    target_type = serializers.ChoiceField(choices=list(TARGETS))
    target_id = serializers.IntegerField()
    text = serializers.CharField(max_length=5000)


def _comment(c):
    return {"id": c.pk, "author": user_brief(c.author), "text": c.text, "created_at": c.created_at}


@api_view(["GET", "POST"])
def comments(request):
    if request.method == "GET":
        obj = _resolve_target(request.user, request.query_params.get("target_type"),
                              request.query_params.get("target_id"))
        ct = ContentType.objects.get_for_model(obj)
        qs = Comment.objects.filter(target_type=ct, target_id=obj.pk).select_related("author")
        return Response([_comment(c) for c in qs])

    s = CommentInput(data=request.data)
    s.is_valid(raise_exception=True)
    obj = _resolve_target(request.user, s.validated_data["target_type"], s.validated_data["target_id"])
    if isinstance(obj, Task) and obj.archived_at is not None:
        raise PermissionDenied("Arxivlangan vazifaga yangi izoh yozib bo'lmaydi.")
    text = s.validated_data["text"].strip()
    if not text:
        return Response({"detail": "Izoh bo'sh bo'lmasin."}, status=400)
    c = Comment.objects.create(author=request.user, text=text, target=obj)
    title = getattr(obj, "title", None) or getattr(obj, "name", "")
    notify(_participants(obj), Notification.Kind.COMMENT, f"{request.user.full_name} izoh yozdi: {title}", obj,
           exclude=request.user)
    log(request.user, "comment", f"{request.user.full_name} izoh yozdi: {title}", obj)
    return Response(_comment(c), status=status.HTTP_201_CREATED)


# ─── Umumiy tarix ────────────────────────────────────────────────────────────


@api_view(["GET"])
def history(request):
    from .reports import PAGE_SIZE, activity_item, activity_queryset, page_slice, read_filters
    filters = read_filters(request.query_params)
    qs = activity_queryset(request.user, filters)
    if request.query_params.get("paginated") == "1":
        page = filters["page"]
        count = qs.count()
        return Response({"count": count, "results": [activity_item(a) for a in page_slice(qs, page)],
                         "next": page * PAGE_SIZE < count, "previous": page > 1})
    return Response([activity_item(a) for a in qs[:200]])


def _file_owner_check(user, kind, pk):
    if kind == "order-version":
        obj = get_object_or_404(OrderVersion.objects.select_related("order"), pk=pk)
        return obj if can_view_order(user, obj.order) else None
    if kind == "project":
        obj = get_object_or_404(ProjectFile.objects.select_related("project__order"), pk=pk)
        department_report = (user.is_department and obj.is_completion and obj.project.order_id
                             and obj.project.order.submitted_by_id == user.pk
                             and obj.project.stage in ("pending_approval", "done", "rejected"))
        return obj if can_view_project(user, obj.project) or department_report else None
    if kind == "task":
        obj = get_object_or_404(TaskFile, pk=pk)
        return obj if visible_tasks(user).filter(pk=obj.task_id).exists() else None
    if kind == "submission":
        obj = get_object_or_404(SubmissionFile.objects.select_related("submission"), pk=pk)
        return obj if visible_tasks(user).filter(pk=obj.submission.task_id).exists() else None
    return None


@api_view(["GET"])
def file_download(request, kind, pk):
    obj = _file_owner_check(request.user, kind, pk)
    if obj is None:
        raise Http404
    try:
        handle = obj.file.open("rb")
    except (FileNotFoundError, ValueError):
        raise Http404
    content_type = mimetypes.guess_type(obj.original_name)[0] or "application/octet-stream"
    inline = request.query_params.get("download") != "1"
    response = FileResponse(handle, as_attachment=not inline, filename=obj.original_name, content_type=content_type)
    response["X-Content-Type-Options"] = "nosniff"
    return response


@api_view(["GET"])
def workdone(request):
    from .reports import read_filters, work_report
    require_manager(request.user)
    return Response(work_report(request.user, read_filters(request.query_params)))


@api_view(["GET"])
def person_profile(request, pk):
    """Bitta xodim (xodim oynasi) — ro'yxatdagi bilan bir xil shakl. Faqat menejerlar ko'radi."""
    require_manager(request.user)
    qs = User.objects.filter(pk=pk, is_active=True).exclude(role="")
    if not request.user.is_boss:
        qs = qs.filter(role=Role.DEVELOPER)
    rows = _people_rows(qs)
    if not rows:
        raise Http404
    rows[0]["report"] = Task.objects.filter(assignments__developer=pk, archived_at__isnull=True).aggregate(
        total=Count("pk"), done=Count("pk", filter=Q(status="done")),
        late=Count("pk", filter=Q(status="done", completed_at__gt=F("due_at"))),
    )
    return Response(rows[0])
