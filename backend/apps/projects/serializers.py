from rest_framework import serializers

from apps.core.api_utils import JSONListField, file_info, user_brief
from apps.core.codes import project_code
from apps.core.files import validate_upload

from .models import Project
from .workflow import project_targets


class ProjectListSerializer(serializers.ModelSerializer):
    code = serializers.SerializerMethodField()
    stage_label = serializers.CharField(source="get_stage_display")
    members = serializers.SerializerMethodField()
    progress = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = ["id", "code", "name", "description", "stage", "stage_label", "start_date", "end_date",
                  "order_id", "members", "progress", "created_at"]

    def get_code(self, obj):
        return project_code(obj.pk)

    def get_members(self, obj):
        return [user_brief(m.developer) for m in obj.memberships.all()]

    def get_progress(self, obj):
        # `task_total` / `task_done` — annotate qilingan (api.py)
        total = getattr(obj, "task_total", 0)
        done = getattr(obj, "task_done", 0)
        return {"total": total, "done": done}


class ProjectDetailSerializer(ProjectListSerializer):
    created_by = serializers.SerializerMethodField()
    files = serializers.SerializerMethodField()
    order = serializers.SerializerMethodField()
    actions = serializers.SerializerMethodField()
    stage_targets = serializers.SerializerMethodField()

    class Meta(ProjectListSerializer.Meta):
        fields = ProjectListSerializer.Meta.fields + ["created_by", "files", "order", "actions", "stage_targets"]

    def get_created_by(self, obj):
        return user_brief(obj.created_by)

    def get_files(self, obj):
        return [file_info(f, "project") for f in obj.files.all()]

    def get_order(self, obj):
        if not obj.order_id:
            return None
        o = obj.order
        return {"id": o.pk, "title": o.title, "department_name": o.submitted_by.department_name,
                "requested_due_date": o.requested_due_date}

    def get_actions(self, obj):
        manager = self.context["request"].user.is_manager
        return {
            "edit": manager,
            "edit_info": manager,  # buyurtmadan bo'lsa ham nomi/izohi tahrirlanadi, buyurtmaga ham ko'chadi
            "members": manager,
            "files": manager,
            "add_task": manager,
        }

    def get_stage_targets(self, obj):
        """PM/Boshliq uchun daraja tanlovi shu ro'yxat bilan cheklanadi (masalan "Tasdiqlash kutilmoqda"
        paytida bo'sh — qaror endi boshqarmaga tegishli)."""
        return list(project_targets(obj.stage, self.context["request"].user.role))


class ProjectCreateSerializer(serializers.Serializer):
    order = serializers.IntegerField(required=False, allow_null=True)
    name = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    description = serializers.CharField(required=False, allow_blank=True, default="")
    start_date = serializers.DateField(required=False, allow_null=True)
    end_date = serializers.DateField(required=False, allow_null=True)
    stage = serializers.ChoiceField(choices=Project.Stage.choices, default=Project.Stage.PLANNED)
    member_ids = JSONListField(child=serializers.IntegerField(), required=False, default=list)
    files = serializers.ListField(child=serializers.FileField(validators=[validate_upload]), required=False, default=list)


class ProjectUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255, required=False)
    description = serializers.CharField(required=False, allow_blank=True)
    start_date = serializers.DateField(required=False)
    end_date = serializers.DateField(required=False)
    stage = serializers.ChoiceField(choices=Project.Stage.choices, required=False)


class MembersSerializer(serializers.Serializer):
    member_ids = serializers.ListField(child=serializers.IntegerField())


class FilesSerializer(serializers.Serializer):
    files = serializers.ListField(child=serializers.FileField(validators=[validate_upload]), allow_empty=False)


class RejectCompletionSerializer(serializers.Serializer):
    reason = serializers.CharField(allow_blank=True)
