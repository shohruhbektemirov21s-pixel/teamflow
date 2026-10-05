from rest_framework import serializers

from .models import WebAgentRun


class WebAgentRequestSerializer(serializers.Serializer):
    task = serializers.CharField(max_length=2000, trim_whitespace=True)
    url = serializers.URLField(required=False, allow_null=True)


class WebAgentRunSerializer(serializers.ModelSerializer):
    class Meta:
        model = WebAgentRun
        fields = ["id", "task", "url", "provider_run_id", "status", "result", "error", "created_at", "updated_at"]
        read_only_fields = fields

