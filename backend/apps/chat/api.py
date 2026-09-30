from django.db.models import Q
from rest_framework import viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.models import User
from apps.core.api_utils import user_brief
from .serializers import ChatMessageSerializer, ChatPartnerSerializer, ChatSendSerializer
from .services import conversation_summaries, messages_with_partner, send_message

class ChatViewSet(viewsets.GenericViewSet):
    @action(detail=False, methods=["get"])
    def people(self, request):
        q = (request.query_params.get("q") or "").strip()
        qs = User.objects.filter(is_active=True).exclude(pk=request.user.pk)
        if q:
            qs = qs.filter(Q(first_name__icontains=q) | Q(last_name__icontains=q) | Q(username__icontains=q))
        qs = qs.order_by("first_name")[:25]
        return Response([user_brief(u) for u in qs])

    @action(detail=False, methods=["get"])
    def conversations(self, request):
        return Response(conversation_summaries(request.user))
        
    @action(detail=False, methods=["get"])
    def messages(self, request):
        serializer = ChatPartnerSerializer(data=request.query_params, context={"request": request})
        serializer.is_valid(raise_exception=True)
        messages = messages_with_partner(request.user, serializer.validated_data["partner"])
        return Response(ChatMessageSerializer(messages, many=True).data)
        
    @action(detail=False, methods=["post"])
    def send(self, request):
        serializer = ChatSendSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        message = send_message(request.user, serializer.validated_data["partner"], serializer.validated_data["text"])
        return Response(ChatMessageSerializer(message).data, status=201)
