from rest_framework import serializers

from apps.accounts.models import User

from .models import ChatMessage


class ChatPartnerSerializer(serializers.Serializer):
    """Validates a chat counterpart for both query strings and request bodies."""

    partner = serializers.PrimaryKeyRelatedField(queryset=User.objects.filter(is_active=True).exclude(role=""))

    def validate_partner(self, partner):
        if partner.pk == self.context["request"].user.pk:
            raise serializers.ValidationError("O'zingizga xabar yubora olmaysiz.")
        return partner


class ChatSendSerializer(ChatPartnerSerializer):
    text = serializers.CharField(max_length=5000, trim_whitespace=True, allow_blank=False)


class ChatMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ChatMessage
        fields = ("id", "text", "created_at", "author_id")

