"""Portfolio biznes amallari. Ruxsat qoidalari — `permissions.py`."""
from django.conf import settings
from django.db import IntegrityError, transaction
from rest_framework.exceptions import PermissionDenied

from apps.core.api_utils import ServiceError

from .files import validate_video
from .models import Follow, PortfolioItem, PortfolioReview, PortfolioVideo
from .permissions import can_edit_item, can_follow, can_review_item
from .stats import invalidate_developer_ranking

# Faqat o'zi qo'shgan loyihada o'zgaradigan maydonlar; TeamFlow loyihasida nomi va sanalari loyihadan olinadi.
MANUAL_ONLY_FIELDS = ("title", "start_date", "end_date")


def _require_owner(user, item):
    if not can_edit_item(user, item):
        raise PermissionDenied("Faqat o'z portfoliongizni o'zgartira olasiz.")


def create_item(user, **data):
    if not user.is_developer:
        raise PermissionDenied("Portfolio faqat dasturchilar uchun.")
    item = PortfolioItem(owner=user, **data)
    item.full_clean()
    item.save()
    invalidate_developer_ranking()
    return item


def update_item(item, user, **data):
    _require_owner(user, item)
    if item.is_auto and any(field in data for field in MANUAL_ONLY_FIELDS):
        raise ServiceError("TeamFlow loyihasining nomi va sanalari loyihadan olinadi, ularni o'zgartirib bo'lmaydi.")
    for field, value in data.items():
        setattr(item, field, value)
    item.full_clean()
    item.save()
    return item


def delete_item(item, user):
    _require_owner(user, item)
    if item.is_auto:
        raise ServiceError("TeamFlow loyihasi portfoliodan o'chirilmaydi.")
    item.delete()  # videolar fayli bilan birga o'chadi (signals.py)
    invalidate_developer_ranking()


def add_video(item, user, file):
    _require_owner(user, item)
    if item.videos.count() >= settings.PORTFOLIO_VIDEOS_PER_ITEM:
        raise ServiceError(f"Bitta loyihaga {settings.PORTFOLIO_VIDEOS_PER_ITEM} tagacha video yuklash mumkin.",
                           field="video")
    validate_video(file)
    return PortfolioVideo.objects.create(item=item, file=file, original_name=file.name[:255])


def delete_video(video, user):
    _require_owner(user, video.item)
    video.delete()


def save_review(item, user, *, stars, text=""):
    if not can_review_item(user, item):
        raise PermissionDenied("O'z loyihangizni baholay olmaysiz.")
    review, _ = PortfolioReview.objects.update_or_create(
        item=item, author=user, defaults={"stars": stars, "text": text.strip()})
    invalidate_developer_ranking()
    return review


def delete_review(item, user):
    deleted, _ = PortfolioReview.objects.filter(item=item, author=user).delete()
    if deleted:
        invalidate_developer_ranking()


def follow(user, developer):
    if not can_follow(user, developer):
        raise ServiceError("O'zingizni kuzata olmaysiz.")
    try:
        with transaction.atomic():
            _, created = Follow.objects.get_or_create(follower=user, developer=developer)
    except IntegrityError:
        pass  # parallel ikki so'rov — kuzatuv baribir bor
    else:
        if created:
            invalidate_developer_ranking()


def unfollow(user, developer):
    deleted, _ = Follow.objects.filter(follower=user, developer=developer).delete()
    if deleted:
        invalidate_developer_ranking()
