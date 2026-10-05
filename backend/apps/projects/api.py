from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from django.utils.dateparse import parse_date
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.api_utils import IsDepartment, IsManager
from apps.core.codes import resolve_code
from apps.orders.permissions import visible_orders

from . import services
from .models import Project
from .permissions import visible_projects
from .serializers import (
    CompletionAckSerializer,
    FilesSerializer,
    MembersSerializer,
    ProjectCreateSerializer,
    ProjectDetailSerializer,
    ProjectListSerializer,
    ProjectUpdateSerializer,
    RejectCompletionSerializer,
)


class ProjectViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    MANAGER_ACTIONS = {"create", "partial_update", "members", "files", "delete_file"}

    def get_queryset(self):
        qs = (
            visible_projects(self.request.user)
            .prefetch_related("memberships__developer")
            .annotate(
                task_total=Count("tasks", filter=Q(tasks__archived_at__isnull=True), distinct=True),
                task_done=Count("tasks", filter=Q(tasks__status="done", tasks__archived_at__isnull=True), distinct=True),
            )
            # Count bilan Meta.ordering qo'llanmaydi — sahifalashda takror/tushib qolish bo'lmasin
            .order_by("-created_at", "-id")
        )
        if self.action == "retrieve":
            qs = qs.select_related("order__submitted_by").prefetch_related("files")
        params = self.request.query_params
        if params.get("stage"):
            qs = qs.filter(stage__in=params["stage"].split(","))
        if params.get("q"):
            code = resolve_code(params["q"])
            if code and code[0] == "project":
                qs = qs.filter(id=code[1])
            else:
                qs = qs.filter(name__icontains=params["q"].strip())
        # Taqvim: tugash sanasi oralig'i (ikkala chegara ham kiradi)
        if params.get("end_from") and (d := parse_date(params["end_from"])):
            qs = qs.filter(end_date__gte=d)
        if params.get("end_to") and (d := parse_date(params["end_to"])):
            qs = qs.filter(end_date__lte=d)
        return qs

    def paginate_queryset(self, queryset):
        # Taqvim butun ro'yxatni oladi: ?all=1 (visible_projects bilan cheklangan)
        if self.request.query_params.get("all") == "1":
            return None
        return super().paginate_queryset(queryset)

    def get_serializer_class(self):
        return ProjectDetailSerializer if self.action == "retrieve" else ProjectListSerializer

    def get_permissions(self):
        if self.action in self.MANAGER_ACTIONS:
            return [*super().get_permissions(), IsManager()]
        if self.action in ("confirm_completion", "reject_completion"):
            return [*super().get_permissions(), IsDepartment()]
        return super().get_permissions()

    def _detail(self, project):
        self.action = "retrieve"
        return ProjectDetailSerializer(self.get_queryset().get(pk=project.pk), context={"request": self.request}).data

    def create(self, request):
        s = ProjectCreateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        data = dict(s.validated_data)
        order_id = data.pop("order", None)
        order = get_object_or_404(visible_orders(request.user), pk=order_id) if order_id else None
        data["files"] = request.FILES.getlist("files") or data.get("files")
        project = services.create_project(request.user, order=order, **data)
        return Response(self._detail(project), status=status.HTTP_201_CREATED)

    def partial_update(self, request, pk=None):
        project = self.get_object()
        s = ProjectUpdateSerializer(data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        services.update_project(project, request.user, **s.validated_data)
        return Response(self._detail(project))

    @action(detail=True, methods=["put"])
    def members(self, request, pk=None):
        project = self.get_object()
        s = MembersSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        services.set_members(project, request.user, s.validated_data["member_ids"])
        return Response(self._detail(project))

    @action(detail=True, methods=["post"])
    def files(self, request, pk=None):
        project = self.get_object()
        s = FilesSerializer(data={"files": request.FILES.getlist("files")})
        s.is_valid(raise_exception=True)
        services.add_files(project, request.user, s.validated_data["files"])
        return Response(self._detail(project), status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["delete"], url_path=r"files/(?P<file_id>\d+)")
    def delete_file(self, request, pk=None, file_id=None):
        project = self.get_object()
        services.delete_file(project, request.user, int(file_id))
        return Response(self._detail(project))

    def _by_order_project(self, pk):
        """Boshqarma `visible_projects` orqali loyihani ko'ra olmaydi (faqat buyurtma orqali bog'liq) —
        shuning uchun bu ikki amalda loyiha to'g'ridan-to'g'ri olinadi, egalik servisda tekshiriladi."""
        return get_object_or_404(Project.objects.select_related("order__submitted_by", "created_by"), pk=pk)

    @action(detail=True, methods=["post"], url_path="confirm-completion")
    def confirm_completion(self, request, pk=None):
        """Boshqarma loyiha yakunlanishini tasdiqlaydi (faqat buyurtmani yuborgan boshqarma — servisda)."""
        project = self._by_order_project(pk)
        services.confirm_completion(project, request.user)
        return Response({"ok": True})

    @action(detail=True, methods=["post"], url_path="reject-completion")
    def reject_completion(self, request, pk=None):
        """Boshqarma kamchilik topsa rad etadi (sabab bilan) — loyiha "Tuzatish kerak" ga qaytadi."""
        project = self._by_order_project(pk)
        s = RejectCompletionSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        services.reject_completion(project, request.user, **s.validated_data)
        return Response({"ok": True})

    @action(detail=True, methods=["post"], url_path="completion-ack")
    def completion_ack(self, request, pk=None):
        """Loyiha a'zosi dasturchi yakunlashni tasdiqlaydi yoki sabab bilan rad etadi."""
        project = self.get_object()
        s = CompletionAckSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        services.ack_completion(project, request.user, **s.validated_data)
        return Response({"ok": True})
