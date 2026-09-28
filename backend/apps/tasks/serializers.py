from rest_framework import serializers

from apps.core.api_utils import JSONListField, file_info, user_brief
from apps.core.choices import Priority
from apps.core.files import validate_upload

from .models import Task
from .permissions import can_work_on
from .workflow import task_targets


class TaskListSerializer(serializers.ModelSerializer):
    project = serializers.SerializerMethodField()
    status_label = serializers.CharField(source="get_status_display")
    priority_label = serializers.CharField(source="get_priority_display")
    assignees = serializers.SerializerMethodField()
    subtasks_progress = serializers.SerializerMethodField()
    is_overdue = serializers.BooleanField(read_only=True)
    finished_late = serializers.BooleanField(read_only=True)

    class Meta:
        model = Task
        fields = ["id", "title", "description", "project", "status", "status_label", "priority", "priority_label",
                  "starts_at", "due_at", "completed_at", "is_overdue", "finished_late", "assignees",
                  "subtasks_progress", "created_at"]

    def get_project(self, obj):
        return {"id": obj.project_id, "name": obj.project.name}

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

    class Meta(TaskListSerializer.Meta):
        fields = TaskListSerializer.Meta.fields + ["created_by", "subtasks", "files", "submissions", "actions"]

    def get_created_by(self, obj):
        return user_brief(obj.created_by)

    def get_subtasks(self, obj):
        user = self.context["request"].user
        mine = user.is_manager or any(a.developer_id == user.pk for a in obj.assignments.all())
        can_manage = (user.is_manager or mine) and obj.status != Task.Status.DONE
        return [
            {"id": s.id, "title": s.title, "is_done": s.is_done, "assignee": user_brief(s.assignee),
             "can_toggle": obj.status != Task.Status.DONE and (mine or s.assignee_id == user.pk),
             "can_delete": can_manage}
            for s in obj.subtasks.all()
        ]

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
            "manage_subtasks": (user.is_manager or worker) and obj.status != Task.Status.DONE,
        }


class SubTaskInput(serializers.Serializer):
    title = serializers.CharField(max_length=255, allow_blank=True)
    assignee_id = serializers.IntegerField(required=False, allow_null=True)
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


class SubmitSerializer(serializers.Serializer):
    note = serializers.CharField(allow_blank=True)
    files = serializers.ListField(child=serializers.FileField(validators=[validate_upload]), required=False, default=list)


class ReviewSerializer(serializers.Serializer):
    decision = serializers.ChoiceField(choices=[("accept", "Qabul"), ("return", "Qaytarish")])
    note = serializers.CharField(required=False, allow_blank=True, default="")


class SubTaskToggleSerializer(serializers.Serializer):
    is_done = serializers.BooleanField()


class FilesSerializer(serializers.Serializer):
    files = serializers.ListField(child=serializers.FileField(validators=[validate_upload]), allow_empty=False)
