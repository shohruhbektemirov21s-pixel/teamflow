"""Taklif biznes amallari. Holat o'tishi faqat `workflow.check_suggestion_transition` orqali."""
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import PermissionDenied

from apps.core.api_utils import ServiceError

from .models import Suggestion, SuggestionVote
from .workflow import check_suggestion_transition

S = Suggestion.Status


def is_author(user, suggestion):
    """Anonim taklif muallifi saqlanmaydi (author=None), shuning uchun u hech kimga "o'ziniki" emas."""
    return not suggestion.is_anonymous and suggestion.author_id == user.pk


def create_suggestion(user, *, title, body, is_anonymous=False):
    return Suggestion.objects.create(
        title=title, body=body, is_anonymous=is_anonymous, author=None if is_anonymous else user,
    )


def delete_suggestion(suggestion, user):
    if not is_author(user, suggestion):
        raise PermissionDenied("Faqat o'zingiz yozgan va anonim bo'lmagan takliflarni o'chira olasiz.")
    if suggestion.status != S.PENDING:
        raise ServiceError("Faqat kutilayotgan takliflarni o'chirish mumkin.")
    suggestion.delete()


def vote(suggestion, user, kind):
    if suggestion.status != S.PENDING:
        raise ServiceError("Faqat kutilayotgan takliflarga ovoz berish mumkin.")
    if is_author(user, suggestion):
        raise ServiceError("O'z taklifingizga ovoz bera olmaysiz.")
    SuggestionVote.objects.update_or_create(suggestion=suggestion, voter=user, defaults={"kind": kind})


def remove_vote(suggestion, user):
    if suggestion.status != S.PENDING:
        raise ServiceError("Faqat kutilayotgan takliflardagi ovozni o'chirish mumkin.")
    SuggestionVote.objects.filter(suggestion=suggestion, voter=user).delete()


@transaction.atomic
def decide(suggestion, user, *, status, boss_note=""):
    if not user.is_boss:
        raise PermissionDenied("Takliflar bo'yicha qarorni faqat boshliq qabul qiladi.")
    suggestion = Suggestion.objects.select_for_update().get(pk=suggestion.pk)
    check_suggestion_transition(suggestion.status, status, user.role)
    suggestion.status = status
    suggestion.boss_note = boss_note.strip()
    suggestion.decided_by = user
    suggestion.decided_at = timezone.now()
    suggestion.save()
    return suggestion
