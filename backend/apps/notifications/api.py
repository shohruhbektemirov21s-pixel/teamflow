from django.apps import apps as django_apps
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Notification

# Bildirishnoma bosilganda frontend qaysi modalni ochishi: ContentType modeli → marshrut turi
TARGET_KIND = {"order": "order", "project": "project", "task": "task"}


def _pending_ack_project_ids(user, notices):
    """`project_completion_ack_requested` bildirishnomalari uchun — foydalanuvchi hali javob
    bermagan loyihalar (javob berilgandan keyin bildirishnomadagi tugma qayta ko'rsatilmasin).
    `notifications` qatlami `projects` modelini statik import qilmaydi (ARCHITECTURE 3-bo'lim),
    shuning uchun `apps.get_model` orqali."""
    project_ids = {
        n.target_id for n in notices
        if n.kind == Notification.Kind.PROJECT_COMPLETION_ACK_REQUESTED and n.target_id
    }
    if not project_ids:
        return set()
    Ack = django_apps.get_model("projects", "ProjectCompletionAck")
    return set(
        Ack.objects.filter(project_id__in=project_ids, developer=user, confirmed__isnull=True)
        .values_list("project_id", flat=True)
    )


def _pending_ack_task_ids(user, notices):
    """`task_submit_ack_requested` bildirishnomalari uchun — xuddi `_pending_ack_project_ids` kabi,
    faqat `tasks.TaskSubmitAck` uchun."""
    task_ids = {
        n.target_id for n in notices
        if n.kind == Notification.Kind.TASK_SUBMIT_ACK_REQUESTED and n.target_id
    }
    if not task_ids:
        return set()
    Ack = django_apps.get_model("tasks", "TaskSubmitAck")
    return set(
        Ack.objects.filter(task_id__in=task_ids, developer=user, confirmed__isnull=True)
        .values_list("task_id", flat=True)
    )


def serialize(n, pending_ack_project_ids=frozenset(), pending_ack_task_ids=frozenset()):
    kind = TARGET_KIND.get(n.target_type.model) if n.target_type_id else None
    needs_ack = (
        (n.kind == Notification.Kind.PROJECT_COMPLETION_ACK_REQUESTED
         and kind == "project" and n.target_id in pending_ack_project_ids)
        or (n.kind == Notification.Kind.TASK_SUBMIT_ACK_REQUESTED
            and kind == "task" and n.target_id in pending_ack_task_ids)
    )
    return {
        "id": n.pk,
        "kind": n.kind,
        "kind_label": n.get_kind_display(),
        "message": n.message,
        "is_read": n.is_read,
        "created_at": n.created_at,
        "target": {"type": kind, "id": n.target_id} if kind else None,
        "needs_ack": needs_ack,
    }


class NotificationViewSet(mixins.ListModelMixin, viewsets.GenericViewSet):
    """Faqat o'z bildirishnomalari."""

    def get_queryset(self):
        qs = Notification.objects.filter(recipient=self.request.user).select_related("target_type")
        if self.request.query_params.get("unread") == "1":
            qs = qs.filter(is_read=False)
        return qs

    def list(self, request):
        page = self.paginate_queryset(self.get_queryset())
        pending_projects = _pending_ack_project_ids(request.user, page)
        pending_tasks = _pending_ack_task_ids(request.user, page)
        return self.get_paginated_response([serialize(n, pending_projects, pending_tasks) for n in page])

    @action(detail=False, methods=["get"])
    def unread_count(self, request):
        return Response({"count": Notification.objects.filter(recipient=request.user, is_read=False).count()})

    @action(detail=True, methods=["post"])
    def read(self, request, pk=None):
        Notification.objects.filter(recipient=request.user, pk=pk).update(is_read=True)
        return Response({"ok": True})

    @action(detail=False, methods=["post"])
    def read_all(self, request):
        Notification.objects.filter(recipient=request.user, is_read=False).update(is_read=True)
        return Response({"ok": True})
