"""Yig'uvchi API: bosh panel, xodimlar, qidiruv, izohlar, umumiy tarix, fayllar."""
import mimetypes

from django.contrib.contenttypes.models import ContentType
from django.db.models import Count, Q
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
from apps.core.api_utils import require_manager, user_brief
from apps.core.models import ActivityLog, Comment
from apps.core.services import log
from apps.notifications.models import Notification
from apps.notifications.services import notify
from apps.orders.models import Order, OrderVersion
from apps.orders.permissions import can_view_order, visible_orders
from apps.projects.models import Project, ProjectFile
from apps.projects.permissions import can_view_project, visible_projects
from apps.tasks.filters import ACTIVE, dashboard_counts
from apps.tasks.models import SubmissionFile, Task, TaskFile
from apps.tasks import workflow as task_workflow
from apps.tasks.permissions import visible_tasks

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
        "task_moves": moves,
    })


# ─── Bosh panel ──────────────────────────────────────────────────────────────


@api_view(["GET"])
def dashboard(request):
    """Karta sonlari. Dasturchi — faqat o'ziga biriktirilganlar, menejer — hammasi."""
    user = request.user
    if user.is_department:
        qs = visible_orders(user)
        return Response({
            "orders": {
                "submitted": qs.filter(status=Order.Status.SUBMITTED).count(),
                "rejected": qs.filter(status=Order.Status.REJECTED).count(),
                "approved": qs.filter(status__in=[Order.Status.APPROVED, Order.Status.PROJECT_CREATED]).count(),
            }
        })
    qs = visible_tasks(user)
    if user.is_developer:
        qs = qs.filter(assignments__developer=user).distinct()
    data = dashboard_counts(qs)
    if user.is_manager:
        data["orders_pending"] = Order.objects.filter(status=Order.Status.SUBMITTED).count()
    return Response(data)


@api_view(["GET"])
def people(request):
    """Xodimlar va band-bo'shligi. PM — dasturchilar; Boshliq — hamma xodimlar. Vazifasi yo'qlar tepada."""
    require_manager(request.user)
    now = timezone.now()
    qs = User.objects.filter(is_active=True).exclude(role="").select_related("specialty")
    if request.user.is_boss:
        if request.query_params.get("role"):
            qs = qs.filter(role=request.query_params["role"])
    else:
        qs = qs.filter(role=Role.DEVELOPER)
    t = "assigned_tasks"
    qs = qs.annotate(
        active_tasks=Count(t, filter=Q(assigned_tasks__status__in=ACTIVE), distinct=True),
        overdue_tasks=Count(t, filter=Q(assigned_tasks__status__in=ACTIVE, assigned_tasks__due_at__lt=now),
                            distinct=True),
        review_tasks=Count(t, filter=Q(assigned_tasks__status=Task.Status.IN_REVIEW), distinct=True),
        done_tasks=Count(t, filter=Q(assigned_tasks__status=Task.Status.DONE), distinct=True),
    ).order_by("active_tasks", "first_name", "last_name")
    users = list(qs)

    # "Hozir nima qilyapti" — jarayondagi vazifalar, bitta so'rov bilan
    doing = {}
    for task in Task.objects.filter(status=Task.Status.IN_PROGRESS, assignees__in=users).distinct().prefetch_related("assignees"):
        for u in task.assignees.all():
            doing.setdefault(u.pk, []).append({"id": task.pk, "title": task.title})

    return Response([
        {
            "id": u.pk, "full_name": u.full_name, "role": u.role, "role_label": u.get_role_display(),
            "specialty": u.specialty.name if u.specialty else "", "department_name": u.department_name,
            "active_tasks": u.active_tasks, "overdue_tasks": u.overdue_tasks,
            "review_tasks": u.review_tasks, "done_tasks": u.done_tasks,
            "doing": doing.get(u.pk, [])[:3],
        }
        for u in users
    ])


# ─── Qidiruv (Ctrl K) ────────────────────────────────────────────────────────


@api_view(["GET"])
def search(request):
    q = request.query_params.get("q", "").strip()
    user = request.user
    if len(q) < 2:
        return Response({"tasks": [], "projects": [], "orders": [], "people": []})
    tasks = visible_tasks(user).filter(Q(title__icontains=q) | Q(description__icontains=q))[:6]
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
        "tasks": [{"id": t.pk, "title": t.title, "status": t.status, "project": t.project.name} for t in tasks],
        "projects": [{"id": p.pk, "name": p.name, "stage": p.stage} for p in projects],
        "orders": [{"id": o.pk, "title": o.title, "status": o.status} for o in orders],
        "people": people,
    })


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
    """Menejer — hammaning tarixi; boshqalar — o'z amallari."""
    qs = ActivityLog.objects.select_related("actor", "target_type")
    if not request.user.is_manager:
        qs = qs.filter(actor=request.user)
    if request.query_params.get("q"):
        qs = qs.filter(message__icontains=request.query_params["q"])
    items = qs[:200]
    kinds = {"order", "project", "task"}
    return Response([
        {
            "id": a.pk, "actor": user_brief(a.actor), "verb": a.verb, "message": a.message, "created_at": a.created_at,
            "target": {"type": a.target_type.model, "id": a.target_id}
            if a.target_type_id and a.target_type.model in kinds else None,
        }
        for a in items
    ])


# ─── Fayllar (ruxsat tekshiruvi bilan) ───────────────────────────────────────


def _file_owner_check(user, kind, pk):
    if kind == "order-version":
        obj = get_object_or_404(OrderVersion.objects.select_related("order"), pk=pk)
        return obj if can_view_order(user, obj.order) else None
    if kind == "project":
        obj = get_object_or_404(ProjectFile.objects.select_related("project"), pk=pk)
        return obj if can_view_project(user, obj.project) else None
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
    """Boshliq uchun: oxirgi bajarilgan ishlar, tekshiruv natijalari, izohlar.
    PM uchun ham ochiq lekin faqat o'z loyihalaridagi ishlar.
    Filter: ?days=7 (default), ?project=ID
    """
    user = request.user
    if not user.is_manager:
        raise PermissionDenied("Bu sahifa faqat menejerlar uchun.")
    
    days = int(request.query_params.get("days", 7))
    since = timezone.now() - timezone.timedelta(days=days)
    
    # 1. So'nggi bajarilgan vazifalar (done holatiga o'tgan)
    from apps.tasks.models import Task, Submission
    task_qs = Task.objects.filter(status=Task.Status.DONE, completed_at__gte=since)
    if not user.is_boss:
        from apps.tasks.permissions import visible_tasks
        task_qs = task_qs.filter(pk__in=visible_tasks(user))
    if request.query_params.get("project"):
        task_qs = task_qs.filter(project_id=request.query_params["project"])
    task_qs = task_qs.select_related("project").prefetch_related("assignees")[:50]
    
    # 2. So'nggi tekshiruvlar (qabul qilingan va qaytarilganlar)
    sub_qs = Submission.objects.filter(
        reviewed_at__gte=since,
        decision__in=["accepted", "returned"]
    ).select_related("task__project", "submitted_by", "reviewed_by")[:50]
    if not user.is_boss:
        from apps.tasks.permissions import visible_tasks
        sub_qs = sub_qs.filter(task__in=visible_tasks(user))
    
    # 3. So'nggi tarix
    history_qs = ActivityLog.objects.filter(created_at__gte=since).select_related("actor")[:50]
    
    result = {
        "completed_tasks": [
            {
                "id": t.pk, "title": t.title,
                "project": {"id": t.project.pk, "name": t.project.name},
                "completed_at": t.completed_at,
                "assignees": [user_brief(a) for a in t.assignees.all()],
            }
            for t in task_qs
        ],
        "reviews": [
            {
                "id": s.pk, "task_id": s.task.pk, "task_title": s.task.title,
                "project": s.task.project.name,
                "submitted_by": user_brief(s.submitted_by),
                "reviewed_by": user_brief(s.reviewed_by),
                "decision": s.decision, "note": s.note[:100],
                "review_note": s.review_note[:100],
                "reviewed_at": s.reviewed_at,
            }
            for s in sub_qs
        ],
        "recent_activity": [
            {
                "id": a.pk, "actor": user_brief(a.actor),
                "verb": a.verb, "message": a.message, "created_at": a.created_at,
            }
            for a in history_qs
        ],
    }
    return Response(result)


@api_view(["GET"])
def person_profile(request, pk):
    """Boshqa xodimning profili — faqat menejerlar ko'radi."""
    require_manager(request.user)
    user = get_object_or_404(User.objects.filter(is_active=True).select_related("specialty"), pk=pk)
    from apps.tasks.models import Task
    task_qs = Task.objects.filter(assignments__developer=user)
    stats = {
        "active": task_qs.filter(status__in=["control", "in_progress"]).count(),
        "in_review": task_qs.filter(status="in_review").count(),
        "done": task_qs.filter(status="done").count(),
    }
    return Response({
        "id": user.pk, "username": user.username,
        "first_name": user.first_name, "last_name": user.last_name,
        "full_name": user.full_name,
        "role": user.role, "role_label": user.get_role_display(),
        "specialty": user.specialty.name if user.specialty else "",
        "department_name": user.department_name,
        "date_joined": user.date_joined,
        "stats": stats,
    })
