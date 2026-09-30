from django.db.models import Prefetch
from django.shortcuts import get_object_or_404
from rest_framework import mixins, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from apps.core.api_utils import require_manager
from apps.projects.permissions import visible_projects

from . import services
from .filters import filter_tasks
from .models import SubTask, Submission, TaskAssignment, WorkLog
from .permissions import visible_tasks
from .serializers import (
    BulkTaskSerializer,
    FilesSerializer,
    ReviewSerializer,
    SubmitSerializer,
    SubTaskCreateSerializer,
    SubTaskToggleSerializer,
    TaskCreateSerializer,
    TaskDetailSerializer,
    TaskListSerializer,
    TaskUpdateSerializer,
    WorkLogInput,
)


class TaskViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    def get_queryset(self):
        qs = visible_tasks(self.request.user).prefetch_related(
            Prefetch("assignments", queryset=TaskAssignment.objects.select_related("developer")),
            "subtasks",
        )
        if self.action == "list":
            return filter_tasks(qs, self.request.query_params, self.request.user).order_by(
                "due_at", "-created_at"
            )
        return qs.prefetch_related(
            "worklogs__author",
            "subtasks__assignee",
            "files",
            Prefetch(
                "submissions",
                queryset=Submission.objects.select_related("submitted_by", "reviewed_by").prefetch_related("files"),
            ),
        )

    def get_serializer_class(self):
        return TaskListSerializer if self.action == "list" else TaskDetailSerializer

    def paginate_queryset(self, queryset):
        # Doska va taqvim butun ro'yxatni oladi: ?all=1 (visible_tasks bilan cheklangan)
        if self.request.query_params.get("all") == "1":
            return None
        return super().paginate_queryset(queryset)

    def _detail(self, task):
        self.action = "retrieve"
        return TaskDetailSerializer(self.get_queryset().get(pk=task.pk), context={"request": self.request}).data

    def create(self, request):
        s = TaskCreateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        data = dict(s.validated_data)
        project = get_object_or_404(visible_projects(request.user), pk=data.pop("project"))
        data["files"] = request.FILES.getlist("files") or data.get("files")
        task = services.create_task(request.user, project, **data)
        return Response(self._detail(task), status=status.HTTP_201_CREATED)

    def partial_update(self, request, pk=None):
        require_manager(request.user)
        task = self.get_object()
        s = TaskUpdateSerializer(data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        services.update_task(task, request.user, **s.validated_data)
        return Response(self._detail(task))

    def destroy(self, request, pk=None):
        require_manager(request.user)
        services.delete_task(self.get_object(), request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def start(self, request, pk=None):
        task = self.get_object()
        services.start_task(task, request.user)
        return Response(self._detail(task))

    @action(detail=True, methods=["post"])
    def submit(self, request, pk=None):
        task = self.get_object()
        s = SubmitSerializer(data={"note": request.data.get("note", ""), "files": request.FILES.getlist("files")})
        s.is_valid(raise_exception=True)
        services.submit_task(task, request.user, **s.validated_data)
        return Response(self._detail(task))

    @action(detail=True, methods=["post"])
    def review(self, request, pk=None):
        require_manager(request.user)
        task = self.get_object()
        s = ReviewSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        services.review_task(task, request.user, **s.validated_data)
        return Response(self._detail(task))

    @action(detail=True, methods=["post"])
    def files(self, request, pk=None):
        task = self.get_object()
        s = FilesSerializer(data={"files": request.FILES.getlist("files")})
        s.is_valid(raise_exception=True)
        services.add_task_files(task, request.user, s.validated_data["files"])
        return Response(self._detail(task), status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path=r"subtasks/(?P<subtask_id>\d+)/toggle")
    def toggle_subtask(self, request, pk=None, subtask_id=None):
        task = self.get_object()
        subtask = get_object_or_404(SubTask, pk=subtask_id, task=task)
        s = SubTaskToggleSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        services.toggle_subtask(subtask, request.user, s.validated_data["is_done"])
        return Response(self._detail(task))

    @action(detail=True, methods=["post"], url_path="subtasks")
    def create_subtask(self, request, pk=None):
        task = self.get_object()
        s = SubTaskCreateSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        services.add_subtask(task, request.user, **s.validated_data)
        return Response(self._detail(task), status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["delete"], url_path=r"subtasks/(?P<subtask_id>\d+)")
    def remove_subtask(self, request, pk=None, subtask_id=None):
        task = self.get_object()
        services.delete_subtask(task, request.user, subtask_id)
        return Response(self._detail(task))


    @action(detail=False, methods=["post"])
    def bulk(self, request):
        s = BulkTaskSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        project = get_object_or_404(visible_projects(request.user), pk=s.validated_data["project"])
        created = services.create_bulk_tasks(request.user, project, s.validated_data["tasks"])
        return Response({"created": len(created)}, status=201)

    def update(self, request, *args, **kwargs):
        raise PermissionDenied("PATCH ishlating.")

    @action(detail=True, methods=["post"])
    def worklogs(self, request, pk=None):
        task = self.get_object()
        serializer = WorkLogInput(data=request.data)
        serializer.is_valid(raise_exception=True)
        services.log_work(task, request.user, **serializer.validated_data)
        return Response(self._detail(task), status=201)

    @action(detail=True, methods=["delete"], url_path=r"worklogs/(?P<entry_id>\d+)")
    def delete_worklog(self, request, pk=None, entry_id=None):
        task = self.get_object()
        entry = get_object_or_404(WorkLog.objects.select_related("task"), pk=entry_id, task=task)
        services.delete_worklog(entry, request.user)
        return Response(self._detail(task))
