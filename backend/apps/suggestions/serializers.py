from rest_framework import serializers

from apps.core.api_utils import user_brief

from .models import Suggestion, SuggestionVote


class SuggestionListSerializer(serializers.ModelSerializer):
    author = serializers.SerializerMethodField()
    votes_for = serializers.IntegerField(read_only=True)
    votes_against = serializers.IntegerField(read_only=True)
    my_vote = serializers.CharField(read_only=True, allow_null=True)

    class Meta:
        model = Suggestion
        fields = ["id", "title", "body", "is_anonymous", "author", "status",
                  "votes_for", "votes_against", "my_vote", "created_at"]

    def get_author(self, obj):
        if obj.is_anonymous:
            return None
        return user_brief(obj.author) if obj.author else None


class SuggestionDetailSerializer(SuggestionListSerializer):
    decided_by = serializers.SerializerMethodField()
    actions = serializers.SerializerMethodField()

    class Meta(SuggestionListSerializer.Meta):
        fields = SuggestionListSerializer.Meta.fields + [
            "boss_note", "decided_by", "decided_at", "actions"
        ]

    def get_decided_by(self, obj):
        return user_brief(obj.decided_by) if obj.decided_by else None

    def get_actions(self, obj):
        user = self.context["request"].user
        is_boss = user.is_boss
        is_author = obj.author_id == user.pk and not obj.is_anonymous
        pending = obj.status == Suggestion.Status.PENDING
        return {
            "decide": is_boss and pending,
            "vote": pending and not is_author,
            "delete": is_author and pending,
        }


class SuggestionCreateSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=255)
    body = serializers.CharField()
    is_anonymous = serializers.BooleanField(default=False)


class VoteSerializer(serializers.Serializer):
    kind = serializers.ChoiceField(choices=SuggestionVote.Kind.choices)


class DecideSerializer(serializers.Serializer):
    status = serializers.ChoiceField(choices=[
        (Suggestion.Status.ACCEPTED, "Qabul qilingan"),
        (Suggestion.Status.REJECTED, "Rad etilgan"),
    ])
    boss_note = serializers.CharField(required=False, allow_blank=True, default="")
