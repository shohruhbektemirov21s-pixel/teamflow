from django.db.models import Count, Max, Q

from apps.core.api_utils import user_brief

from .models import ChatMessage


def conversation_summaries(user):
    """Return one latest message per partner without one unread query per row."""
    outgoing_ids = ChatMessage.objects.filter(author=user).values("recipient_id").annotate(last_id=Max("id"))
    incoming_ids = ChatMessage.objects.filter(recipient=user).values("author_id").annotate(last_id=Max("id"))
    last_ids = set(outgoing_ids.values_list("last_id", flat=True))
    last_ids.update(incoming_ids.values_list("last_id", flat=True))

    unread_by_author = dict(
        ChatMessage.objects.filter(recipient=user, is_read=False)
        .values("author_id")
        .annotate(total=Count("id"))
        .values_list("author_id", "total")
    )
    messages = (
        ChatMessage.objects.filter(id__in=last_ids)
        .select_related("author", "recipient")
        .order_by("-created_at", "-id")
    )
    summaries = []
    seen_partner_ids = set()
    for message in messages:
        partner = message.recipient if message.author_id == user.pk else message.author
        if partner.pk in seen_partner_ids:
            continue
        seen_partner_ids.add(partner.pk)
        summaries.append(
            {
                "partner": user_brief(partner),
                "last_message": message.text[:100],
                "last_at": message.created_at,
                "outgoing": message.author_id == user.pk,
                "unread_count": unread_by_author.get(partner.pk, 0),
            }
        )
    return summaries


def messages_with_partner(user, partner):
    messages = ChatMessage.objects.filter(
        Q(author=user, recipient=partner) | Q(author=partner, recipient=user)
    ).order_by("created_at", "id")
    ChatMessage.objects.filter(author=partner, recipient=user, is_read=False).update(is_read=True)
    return messages


def send_message(author, partner, text):
    return ChatMessage.objects.create(author=author, recipient=partner, text=text)
