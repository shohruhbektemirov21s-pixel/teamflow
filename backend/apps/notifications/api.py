from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Notification

# Bildirishnoma bosilganda frontend qaysi modalni ochishi: ContentType modeli → marshrut turi
TARGET_KIND = {"order": "order", "project": "project", "task": "task"}


def serialize(n):
    kind = TARGET_KIND.get(n.target_type.model) if n.target_type_id else None
    return {
        "id": n.pk,
        "kind": n.kind,
        "kind_label": n.get_kind_display(),
        "message": n.message,
        "is_read": n.is_read,
        "created_at": n.created_at,
        "target": {"type": kind, "id": n.target_id} if kind else None,
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
        return self.get_paginated_response([serialize(n) for n in page])

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
