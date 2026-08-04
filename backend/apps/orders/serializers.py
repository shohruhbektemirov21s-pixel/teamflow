from rest_framework import serializers

from apps.core.api_utils import file_info, user_brief
from apps.core.choices import Priority
from apps.core.files import validate_upload

from .models import Order, OrderVersion
from .workflow import order_targets


class OrderVersionSerializer(serializers.ModelSerializer):
    file = serializers.SerializerMethodField()
    decided_by = serializers.SerializerMethodField()
    decision_label = serializers.CharField(source="get_decision_display")

    class Meta:
        model = OrderVersion
        fields = ["id", "number", "file", "note", "decision", "decision_label", "reject_reason",
                  "decided_by", "decided_at", "created_at"]

    def get_file(self, obj):
        return file_info(obj, "order-version")

    def get_decided_by(self, obj):
        return user_brief(obj.decided_by)


class OrderListSerializer(serializers.ModelSerializer):
    submitted_by = serializers.SerializerMethodField()
    status_label = serializers.CharField(source="get_status_display")
    priority_label = serializers.CharField(source="get_priority_display")
    version = serializers.SerializerMethodField()

    class Meta:
        model = Order
        fields = ["id", "title", "description", "priority", "priority_label", "status", "status_label",
                  "requested_due_date", "start_date", "end_date", "submitted_by", "version", "created_at"]

    def get_submitted_by(self, obj):
        return user_brief(obj.submitted_by)

    def get_version(self, obj):
        # `versions` prefetch qilingan — qo'shimcha so'rov yo'q
        versions = list(obj.versions.all())
        return versions[-1].number if versions else None


class OrderDetailSerializer(OrderListSerializer):
    approved_by = serializers.SerializerMethodField()
    versions = OrderVersionSerializer(many=True, read_only=True)
    project_id = serializers.SerializerMethodField()
    actions = serializers.SerializerMethodField()

    class Meta(OrderListSerializer.Meta):
        fields = OrderListSerializer.Meta.fields + [
            "approved_by", "pm_note", "decided_at", "versions", "project_id", "actions",
        ]

    def get_approved_by(self, obj):
        return user_brief(obj.approved_by)

    def get_project_id(self, obj):
        project = getattr(obj, "project", None)
        return project.pk if project else None

    def get_actions(self, obj):
        """UI qaysi tugmalarni ko'rsatishini server aytadi (tekshiruv baribir serverda)."""
        user = self.context["request"].user
        targets = order_targets(obj.status, user.role)
        is_owner = obj.submitted_by_id == user.pk
        return {
            "approve": Order.Status.APPROVED in targets,
            "reject": Order.Status.REJECTED in targets,
            "new_version": is_owner and Order.Status.SUBMITTED in targets,
            "create_project": Order.Status.PROJECT_CREATED in targets,
            "edit_dates": user.is_manager and obj.status in (Order.Status.APPROVED, Order.Status.PROJECT_CREATED),
        }


class OrderCreateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255)
    description = serializers.CharField(required=False, allow_blank=True, default="")
    priority = serializers.ChoiceField(choices=Priority.choices, default=Priority.MEDIUM)
    requested_due_date = serializers.DateField()
    file = serializers.FileField(validators=[validate_upload])


class OrderVersionCreateSerializer(serializers.Serializer):
    file = serializers.FileField(validators=[validate_upload])
    note = serializers.CharField(allow_blank=True, default="")


class ApproveSerializer(serializers.Serializer):
    start_date = serializers.DateField()
    end_date = serializers.DateField()
    note = serializers.CharField(required=False, allow_blank=True, default="")
    priority = serializers.ChoiceField(choices=Priority.choices, required=False)


class RejectSerializer(serializers.Serializer):
    reason = serializers.CharField(allow_blank=True)


class DatesSerializer(serializers.Serializer):
    start_date = serializers.DateField()
    end_date = serializers.DateField()
