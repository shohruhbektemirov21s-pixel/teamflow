from rest_framework import serializers

from apps.core.api_utils import JSONListField, file_info, user_brief
from apps.core.files import validate_upload

from .models import Project
from .workflow import completion_locked, pending_acks, project_targets

S = Project.Stage


class ProjectListSerializer(serializers.ModelSerializer):
    stage_label = serializers.CharField(source="get_stage_display")
    members = serializers.SerializerMethodField()
    progress = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = ["id", "code", "name", "description", "stage", "stage_label", "start_date", "end_date",
                  "order_id", "members", "progress", "created_at"]

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
    completion = serializers.SerializerMethodField()

    class Meta(ProjectListSerializer.Meta):
        fields = ProjectListSerializer.Meta.fields + [
            "created_by", "files", "order", "actions", "stage_targets", "completion", "completion_note",
        ]

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
            "add_task": manager and not completion_locked(obj),
        }

    def _completion_acks(self, obj):
        if not obj.completion_requested_at:
            return None
        acks = list(obj.completion_acks.all())
        return acks

    def get_stage_targets(self, obj):
        """PM/Boshliq uchun daraja tanlovi shu ro'yxat bilan cheklanadi (masalan "Tasdiqlash kutilmoqda"
        paytida bo'sh — qaror endi boshqarmaga tegishli). Dasturchi tasdig'i hali kutilayotgan paytda
        "Yakunlangan" qayta tanlanmaydi; hammasi rozi bo'lgach PM yakunlay oladi."""
        targets = list(project_targets(obj.stage, self.context["request"].user.role))
        if pending_acks(obj):
            targets = [t for t in targets if t != S.DONE]
        return targets

    def get_completion(self, obj):
        """Yakunlash uchun dasturchi tasdig'i hali kutilayotgan bo'lsa — kim tasdiqladi, kim kutilmoqda.
        Hammasi rozi bo'lgach pending bo'shaydi, confirmed ro'yxati PM yakunlaguncha saqlanadi."""
        acks = self._completion_acks(obj)
        if not acks:
            return None
        return {
            "requested_at": obj.completion_requested_at,
            "pending": [user_brief(a.developer) for a in pending_acks(obj)],
            "confirmed": [user_brief(a.developer) for a in acks if a.confirmed is True],
        }


class ProjectCreateSerializer(serializers.Serializer):
    order = serializers.IntegerField(required=False, allow_null=True)
    code = serializers.CharField(max_length=32)
    name = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")
    description = serializers.CharField(required=False, allow_blank=True, default="")
    start_date = serializers.DateField(required=False, allow_null=True)
    end_date = serializers.DateField(required=False, allow_null=True)
    stage = serializers.ChoiceField(
        choices=[(value, label) for value, label in Project.Stage.choices
                 if value != Project.Stage.PENDING_APPROVAL],
        default=Project.Stage.PLANNED,
    )
    member_ids = JSONListField(child=serializers.IntegerField(), required=False, default=list)
    files = serializers.ListField(child=serializers.FileField(validators=[validate_upload]), required=False, default=list)


class ProjectUpdateSerializer(serializers.Serializer):
    completion_note = serializers.CharField(max_length=1000, required=False, allow_blank=True)
    files = serializers.ListField(child=serializers.FileField(validators=[validate_upload]), required=False)
    name = serializers.CharField(max_length=255, required=False)
    description = serializers.CharField(required=False, allow_blank=True)
    start_date = serializers.DateField(required=False)
    end_date = serializers.DateField(required=False)
    # PENDING_APPROVAL tanlovdan chiqarilgan — u faqat "done" so'ralganda ichki hosil bo'ladigan oraliq
    # holat (services._apply_stage), foydalanuvchi to'g'ridan-to'g'ri tanlamasligi kerak.
    stage = serializers.ChoiceField(
        choices=[(v, l) for v, l in Project.Stage.choices if v != Project.Stage.PENDING_APPROVAL],
        required=False,
    )


class MembersSerializer(serializers.Serializer):
    member_ids = serializers.ListField(child=serializers.IntegerField())


class FilesSerializer(serializers.Serializer):
    files = serializers.ListField(child=serializers.FileField(validators=[validate_upload]), allow_empty=False)


class RejectCompletionSerializer(serializers.Serializer):
    reason = serializers.CharField(allow_blank=True)


class CompletionAckSerializer(serializers.Serializer):
    confirmed = serializers.BooleanField()
    reason = serializers.CharField(required=False, allow_blank=True, default="")
