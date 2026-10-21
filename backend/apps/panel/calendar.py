from datetime import timedelta

from django.db.models import Count, F, Prefetch, Q, Window
from django.db.models.functions import RowNumber, TruncDate
from django.utils import timezone
from rest_framework import serializers
from rest_framework.decorators import api_view
from rest_framework.response import Response

from apps.projects.permissions import visible_projects
from apps.projects.serializers import ProjectListSerializer
from apps.tasks.filters import _day_range
from apps.tasks.models import TaskAssignment
from apps.tasks.permissions import listed_tasks
from apps.tasks.serializers import TaskListSerializer


class CalendarRange(serializers.Serializer):
    start = serializers.DateField()
    end = serializers.DateField()

    def validate(self, values):
        if not 0 <= (values["end"] - values["start"]).days <= 42:
            raise serializers.ValidationError("Taqvim oralig'i 43 kundan oshmasin.")
        return values


@api_view(["GET"])
def calendar_summary(request):
    validator = CalendarRange(data=request.query_params)
    validator.is_valid(raise_exception=True)
    start, end = validator.validated_data["start"], validator.validated_data["end"]
    tasks = listed_tasks(request.user).filter(due_at__gte=_day_range(start)[0],
                                              due_at__lt=_day_range(end + timedelta(days=1))[0])
    task_counts = {str(item["day"]): item["total"] for item in tasks.order_by().annotate(
        day=TruncDate("due_at", tzinfo=timezone.get_current_timezone())
    ).values("day").annotate(total=Count("pk", distinct=True))}
    preview_tasks = tasks.annotate(_rank=Window(
        expression=RowNumber(), partition_by=[TruncDate("due_at", tzinfo=timezone.get_current_timezone())],
        order_by=[F("due_at").asc(), F("pk").asc()],
    )).filter(_rank__lte=3).prefetch_related(
        Prefetch("assignments", queryset=TaskAssignment.objects.select_related("developer")), "subtasks")
    projects = visible_projects(request.user).filter(end_date__gte=start, end_date__lte=end)
    project_counts = {str(item["end_date"]): item["total"] for item in projects.order_by().values(
        "end_date").annotate(total=Count("pk", distinct=True))}
    preview_projects = projects.annotate(_rank=Window(
        expression=RowNumber(), partition_by=[F("end_date")], order_by=[F("pk").asc()],
    )).filter(_rank__lte=3).prefetch_related("memberships__developer").annotate(
        task_total=Count("tasks", filter=Q(tasks__archived_at__isnull=True), distinct=True),
        task_done=Count("tasks", filter=Q(tasks__status="done", tasks__archived_at__isnull=True), distinct=True))
    return Response({"tasks": TaskListSerializer(preview_tasks, many=True).data,
                     "projects": ProjectListSerializer(preview_projects, many=True).data,
                     "task_counts": task_counts, "project_counts": project_counts})
