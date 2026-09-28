from django.db.models import Q, Max
from rest_framework import mixins, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.accounts.models import User
from apps.core.api_utils import user_brief
from .models import ChatMessage

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
        me = request.user
        last_ids = set()
        for direction in ("recipient_id", "author_id"):
            col = "author" if direction == "recipient_id" else "recipient"
            last_ids.update(
                ChatMessage.objects.filter(**{col: me})
                .values(direction).annotate(last=Max("id"))
                .values_list("last", flat=True)
            )
            
        messages = ChatMessage.objects.filter(id__in=last_ids).select_related("author", "recipient").order_by("-created_at")
        out = []
        seen = set()
        for m in messages:
            partner = m.recipient if m.author_id == me.id else m.author
            if partner.id in seen: continue
            seen.add(partner.id)
            out.append({
                "partner": user_brief(partner),
                "last_message": m.text[:100],
                "last_at": m.created_at,
                "outgoing": m.author_id == me.id,
                "unread_count": ChatMessage.objects.filter(author=partner, recipient=me, is_read=False).count()
            })
        return Response(out)
        
    @action(detail=False, methods=["get"])
    def messages(self, request):
        partner_id = request.query_params.get("partner")
        if not partner_id: return Response([])
        me = request.user
        qs = ChatMessage.objects.filter(
            Q(author=me, recipient_id=partner_id) | Q(author_id=partner_id, recipient=me)
        ).order_by("created_at")
        
        ChatMessage.objects.filter(author_id=partner_id, recipient=me, is_read=False).update(is_read=True)
        
        return Response([{
            "id": m.id,
            "text": m.text,
            "created_at": m.created_at,
            "author_id": m.author_id,
        } for m in qs])
        
    @action(detail=False, methods=["post"])
    def send(self, request):
        partner_id = request.data.get("partner")
        text = request.data.get("text", "").strip()
        if not partner_id or not text: return Response({"error": "partner and text required"}, status=400)
        
        partner = User.objects.filter(pk=partner_id).first()
        if not partner: return Response({"error": "partner not found"}, status=404)
        
        m = ChatMessage.objects.create(author=request.user, recipient=partner, text=text)
        return Response({
            "id": m.id,
            "text": m.text,
            "created_at": m.created_at,
            "author_id": m.author_id,
        })
