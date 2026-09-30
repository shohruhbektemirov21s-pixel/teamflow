from decimal import Decimal

from django.utils import timezone
from rest_framework import serializers

from apps.core.api_utils import JSONListField, file_info, user_brief
from apps.core.choices import Priority
from apps.core.codes import project_code, task_code
from apps.core.files import validate_upload
from apps.projects.serializers import ProjectCreateSerializer

from .models import Task
from .permissions import can_manage_assignees, can_manage_subtasks, can_work_on
from .workflow import task_targets


class TaskListSerializer(serializers.ModelSerializer):
    code = serializers.SerializerMethodField()
    project = serializers.SerializerMethodField()
    status_label = serializers.CharField(source="get_status_display")
    priority_label = serializers.CharField(source="get_priority_display")
    assignees = serializers.SerializerMethodField()
    subtasks_progress = serializers.SerializerMethodField()
    is_overdue = serializers.BooleanField(read_only=True)
    finished_late = serializers.BooleanField(read_only=True)

    class Meta:
        model = Task
        fields = ["id", "code", "title", "description", "project", "status", "status_label", "priority", "priority_label",
                  "starts_at", "due_at", "completed_at", "is_overdue", "finished_late", "assignees",
                  "subtasks_progress", "created_at"]

    def get_code(self, obj):
        return task_code(obj.pk)

    def get_project(self, obj):
        return {"id": obj.project_id, "name": obj.project.name, "code": project_code(obj.project_id)}

    def get_assignees(self, obj):
        return [user_brief(a.developer) for a in obj.assignments.all()]

    def get_subtasks_progress(self, obj):
        items = obj.subtasks.all()
        return {"done": sum(1 for s in items if s.is_done), "total": len(items)}


class TaskDetailSerializer(TaskListSerializer):
    created_by = serializers.SerializerMethodField()
    subtasks = serializers.SerializerMethodField()
    files = serializers.SerializerMethodField()
    submissions = serializers.SerializerMethodField()
    actions = serializers.SerializerMethodField()
    worklogs = serializers.SerializerMethodField()
    worklog_hours = serializers.SerializerMethodField()

    class Meta(TaskListSerializer.Meta):
        fields = TaskListSerializer.Meta.fields + ["created_by", "subtasks", "files", "submissions", "actions", "worklogs", "worklog_hours"]

    def get_worklogs(self, obj):
        user = self.context["request"].user
        return [
            {"id": entry.pk, "author": user_brief(entry.author), "work_date": entry.work_date,
             "hours": str(entry.hours), "note": entry.note,
             "can_delete": user.is_manager or entry.author_id == user.pk}
            for entry in obj.worklogs.all()
        ]

    def get_worklog_hours(self, obj):
        return format(sum((entry.hours for entry in obj.worklogs.all()), Decimal("0")), ".2f")

    def get_created_by(self, obj):
        return user_brief(obj.created_by)

    def get_subtasks(self, obj):
        user = self.context["request"].user
        mine = user.is_manager or any(a.developer_id == user.pk for a in obj.assignments.all())
        can_manage = can_manage_subtasks(user, obj) and obj.status != Task.Status.DONE
        rows = []
        for s in obj.subtasks.all():
            people = list(s.assignees.all())
            rows.append({
                "id": s.id, "title": s.title, "is_done": s.is_done, "assignees": [user_brief(u) for u in people],
                "can_toggle": obj.status != Task.Status.DONE and (mine or any(u.pk == user.pk for u in people)),
                "can_delete": can_manage,
            })
        return rows

    def get_files(self, obj):
        return [file_info(f, "task") for f in obj.files.all()]

    def get_submissions(self, obj):
        return [
            {"id": s.id, "round": s.round, "note": s.note, "submitted_by": user_brief(s.submitted_by),
             "submitted_at": s.submitted_at, "decision": s.decision, "decision_label": s.get_decision_display(),
             "reviewed_by": user_brief(s.reviewed_by), "review_note": s.review_note, "reviewed_at": s.reviewed_at,
             "files": [file_info(f, "submission") for f in s.files.all()]}
            for s in obj.submissions.all()
        ]

    def get_actions(self, obj):
        user = self.context["request"].user
        targets = task_targets(obj.status, user.role)
        worker = can_work_on(user, obj)
        return {
            "start": worker and Task.Status.IN_PROGRESS in targets and obj.status == Task.Status.CONTROL,
            "submit": worker and Task.Status.IN_REVIEW in targets,
            "review": Task.Status.DONE in targets,
            "edit": user.is_manager,
            "delete": user.is_manager,
            "add_files": worker and obj.status != Task.Status.DONE,
            "log_work": worker,
            "manage_subtasks": can_manage_subtasks(user, obj) and obj.status != Task.Status.DONE,
            "manage_assignees": can_manage_assignees(user, obj) and obj.status != Task.Status.DONE,
        }


class SubTaskInput(serializers.Serializer):
    title = serializers.CharField(max_length=255, allow_blank=True)
    assignee_ids = serializers.ListField(child=serializers.IntegerField(min_value=1), required=False, default=list)
    is_done = serializers.BooleanField(required=False, default=False)


class TaskCreateSerializer(serializers.Serializer):
    project = serializers.IntegerField()
    title = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, allow_blank=True, default="")
    priority = serializers.ChoiceField(choices=Priority.choices, default=Priority.MEDIUM)
    starts_at = serializers.DateTimeField(required=False, allow_null=True)
    due_at = serializers.DateTimeField(required=False, allow_null=True)
    assignee_ids = JSONListField(child=serializers.IntegerField(), required=False, default=list)
    subtasks = JSONListField(child=SubTaskInput(), required=False, default=list)
    files = serializers.ListField(child=serializers.FileField(validators=[validate_upload]), required=False, default=list)


class TaskUpdateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255, required=False)
    description = serializers.CharField(required=False, allow_blank=True)
    priority = serializers.ChoiceField(choices=Priority.choices, required=False)
    starts_at = serializers.DateTimeField(required=False, allow_null=True)
    due_at = serializers.DateTimeField(required=False, allow_null=True)
    assignee_ids = serializers.ListField(child=serializers.IntegerField(), required=False)
    subtasks = serializers.ListField(child=SubTaskInput(), required=False)


class BulkTaskItemSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, allow_blank=True, default="")
    priority = serializers.ChoiceField(choices=Priority.choices, default=Priority.MEDIUM)
    starts_at = serializers.DateTimeField(required=False, allow_null=True)
    due_at = serializers.DateTimeField(required=False, allow_null=True)
    assignee_ids = serializers.ListField(child=serializers.IntegerField(min_value=1), required=False, default=list)


class BulkTaskSerializer(serializers.Serializer):
    project = serializers.IntegerField(min_value=1)
    tasks = serializers.ListField(child=BulkTaskItemSerializer(), min_length=1, max_length=100, required=False)
    titles = serializers.ListField(child=serializers.CharField(max_length=255), min_length=1, max_length=100, required=False)
    assignee_ids = serializers.ListField(child=serializers.IntegerField(min_value=1), required=False, default=list)
    priority = serializers.ChoiceField(choices=Priority.choices, default=Priority.MEDIUM)
    description = serializers.CharField(required=False, allow_blank=True, default="")
    due_at = serializers.DateTimeField(required=False, allow_null=True)

    def validate(self, data):
        if ("tasks" in data) == ("titles" in data):
            raise serializers.ValidationError("Vazifalar ro'yxatini bitta usulda yuboring.")
        if "titles" in data:
            data["tasks"] = [
                {"title": title, "assignee_ids": data["assignee_ids"], "priority": data["priority"],
                 "description": data["description"], "due_at": data.get("due_at")}
                for title in data["titles"]
            ]
        return data


class SetupTaskSerializer(serializers.Serializer):
    """Loyiha yaratishda bitta xodimga beriladigan vazifa (fayllari `task_files_<n>` bilan alohida keladi)."""

    title = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, allow_blank=True, default="")
    assignee_id = serializers.IntegerField(min_value=1)
    starts_at = serializers.DateTimeField(required=False, allow_null=True)
    due_at = serializers.DateTimeField(required=False, allow_null=True)


class ProjectSetupSerializer(ProjectCreateSerializer):
    """Loyiha + jamoa + har bir xodimga alohida vazifalar — bitta so'rovda."""

    tasks = JSONListField(child=SetupTaskSerializer(), required=False, default=list, max_length=100)


class SubmitSerializer(serializers.Serializer):
    note = serializers.CharField(allow_blank=True)
    files = serializers.ListField(child=serializers.FileField(validators=[validate_upload]), required=False, default=list)


class ReviewSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(choices=[("accept", "Qabul"), ("return", "Qaytarish")])
    note = serializers.CharField(required=False, allow_blank=True, default="")


class SubTaskCreateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255)
    assignee_ids = serializers.ListField(child=serializers.IntegerField(min_value=1), required=False, default=list)


class AssigneesSerializer(serializers.Serializer):
    """Vazifa yoki sub-vazifa ijrochilari (vazifa oynasidan)."""
    assignee_ids = serializers.ListField(child=serializers.IntegerField(min_value=1))


class SubTaskToggleSerializer(serializers.Serializer):
    is_done = serializers.BooleanField()


class FilesSerializer(serializers.Serializer):
    files = serializers.ListField(child=serializers.FileField(validators=[validate_upload]), allow_empty=False)


class WorkLogInput(serializers.Serializer):
    work_date = serializers.DateField()
    hours = serializers.DecimalField(max_digits=4, decimal_places=2, min_value=Decimal("0.01"), max_value=Decimal("24"))
    note = serializers.CharField(max_length=5000)

    def validate_work_date(self, value):
        if value > timezone.localdate():
            raise serializers.ValidationError("Kelajak sanasiga bajarilgan ish yozib bo'lmaydi.")
        return value
