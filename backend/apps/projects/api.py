from django.db.models import Count, Q
from django.shortcuts import get_object_or_404
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.core.api_utils import IsManager
from apps.orders.permissions import visible_orders

from . import services
from .permissions import visible_projects
from .serializers import (
    FilesSerializer,
    MembersSerializer,
    ProjectCreateSerializer,
    ProjectDetailSerializer,
    ProjectListSerializer,
    ProjectUpdateSerializer,
)


class ProjectViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    MANAGER_ACTIONS = {"create", "partial_update", "members", "files", "delete_file"}

    def get_queryset(self):
        qs = (
            visible_projects(self.request.user)
            .prefetch_related("memberships__developer")
            .annotate(
                task_total=Count("tasks", distinct=True),
                task_done=Count("tasks", filter=Q(tasks__status="done"), distinct=True),
            )
        )
        if self.action == "retrieve":
            qs = qs.select_related("order__submitted_by").prefetch_related("files")
        params = self.request.query_params
        if params.get("stage"):
            qs = qs.filter(stage__in=params["stage"].split(","))
        if params.get("q"):
            qs = qs.filter(name__icontains=params["q"])
        return qs

    def get_serializer_class(self):
        return ProjectDetailSerializer if self.action == "retrieve" else ProjectListSerializer

    def get_permissions(self):
        if self.action in self.MANAGER_ACTIONS:
            return [*super().get_permissions(), IsManager()]
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
