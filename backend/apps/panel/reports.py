"""Hisobot filtrlari, ruxsatli faoliyat va sahifalash."""
from django.contrib.contenttypes.models import ContentType
from django.db.models import Q
from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework import serializers

from apps.core.api_utils import user_brief
from apps.core.models import ActivityLog
from apps.orders.models import Order
from apps.projects.models import Project
from apps.projects.permissions import visible_projects
from apps.tasks.models import Submission, Task
from apps.tasks.permissions import visible_tasks

PAGE_SIZE = 20


class ReportFilters(serializers.Serializer):
    project = serializers.IntegerField(min_value=1, required=False)
    task = serializers.IntegerField(min_value=1, required=False)
    days = serializers.IntegerField(min_value=1, max_value=365, required=False)
    page = serializers.IntegerField(min_value=1, max_value=100000, default=1)
    q = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")
    mine = serializers.BooleanField(required=False, default=False)


def read_filters(params):
    serializer = ReportFilters(data=params)
    serializer.is_valid(raise_exception=True)
    return serializer.validated_data


def activity_queryset(user, filters):
    qs = ActivityLog.objects.select_related("actor", "target_type").order_by("-created_at", "-pk")
    task_type = ContentType.objects.get_for_model(Task)
    if filters.get("task"):
        task = get_object_or_404(visible_tasks(user), pk=filters["task"])
        qs = qs.filter(target_type=task_type, target_id=task.pk)
    elif filters.get("project"):
        project = get_object_or_404(visible_projects(user), pk=filters["project"])
        project_type = ContentType.objects.get_for_model(Project)
        task_ids = visible_tasks(user).filter(project=project).values("pk")
        scope = Q(target_type=project_type, target_id=project.pk) | Q(target_type=task_type, target_id__in=task_ids)
        if user.is_manager and project.order_id:
            scope |= Q(target_type=ContentType.objects.get_for_model(Order), target_id=project.order_id)
        qs = qs.filter(scope)
    elif not user.is_manager:
        qs = qs.filter(actor=user)
    if filters.get("mine"):
        qs = qs.filter(actor=user)
    if filters.get("days"):
        qs = qs.filter(created_at__gte=timezone.now() - timezone.timedelta(days=filters["days"]))
    if filters.get("q"):
        qs = qs.filter(message__icontains=filters["q"])
    return qs


def activity_item(item):
    kind = item.target_type.model if item.target_type_id else None
    return {
        "id": item.pk, "actor": user_brief(item.actor), "verb": item.verb,
        "message": item.message, "created_at": item.created_at,
        "target": {"type": kind, "id": item.target_id} if kind in {"order", "project", "task"} else None,
    }


def page_slice(qs, page):
    offset = (page - 1) * PAGE_SIZE
    return qs[offset:offset + PAGE_SIZE]


def work_report(user, filters):
    since = timezone.now() - timezone.timedelta(days=filters.get("days", 7))
    tasks = visible_tasks(user)
    if filters.get("project"):
        project = get_object_or_404(visible_projects(user), pk=filters["project"])
        tasks = tasks.filter(project=project)
    if filters.get("q"):
        tasks = tasks.filter(Q(title__icontains=filters["q"]) | Q(project__name__icontains=filters["q"]))
    mine = filters.get("mine")
    completed = tasks.filter(status=Task.Status.DONE, completed_at__gte=since)
    if mine:
        # Menejer vazifa ijrochisi bo'la olmaydi — "o'zi qilgani" uning yaratgan vazifalari.
        completed = completed.filter(created_by=user)
    completed = completed.prefetch_related("assignees").order_by("-completed_at", "-pk").distinct()
    reviews = Submission.objects.filter(
        task__in=tasks, reviewed_at__gte=since, decision__in=["accepted", "returned"],
    )
    if mine:
        reviews = reviews.filter(reviewed_by=user)
    reviews = reviews.select_related("task__project", "submitted_by", "reviewed_by").order_by("-reviewed_at", "-pk")
    history = activity_queryset(user, filters).filter(created_at__gte=since)
    page = filters["page"]
    return {
        "page": page, "page_size": PAGE_SIZE,
        "counts": {"tasks": completed.count(), "reviews": reviews.count(), "history": history.count()},
        "completed_tasks": [
            {"id": task.pk, "title": task.title, "project": {"id": task.project_id, "name": task.project.name},
             "completed_at": task.completed_at, "assignees": [user_brief(a) for a in task.assignees.all()]}
            for task in page_slice(completed, page)
        ],
        "reviews": [
            {"id": review.pk, "task_id": review.task_id, "task_title": review.task.title,
             "project": review.task.project.name, "submitted_by": user_brief(review.submitted_by),
             "reviewed_by": user_brief(review.reviewed_by), "decision": review.decision,
             "decision_label": review.get_decision_display(), "note": review.note,
             "review_note": review.review_note, "reviewed_at": review.reviewed_at}
            for review in page_slice(reviews, page)
        ],
        "recent_activity": [activity_item(item) for item in page_slice(history, page)],
    }
