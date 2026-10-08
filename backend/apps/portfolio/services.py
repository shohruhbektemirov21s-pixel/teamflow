"""Portfolio biznes amallari. Ruxsat qoidalari — `permissions.py`."""
from django.conf import settings
from django.db import IntegrityError, transaction
from rest_framework.exceptions import PermissionDenied

from apps.core.api_utils import ServiceError
from apps.projects.models import ProjectMember

from .files import validate_video
from .models import Follow, PortfolioItem, PortfolioReview, PortfolioVideo
from .permissions import can_edit_item, can_follow, can_review_item

# Faqat o'zi qo'shgan loyihada o'zgaradigan maydonlar; TeamFlow loyihasida nomi va sanalari loyihadan olinadi.
MANUAL_ONLY_FIELDS = ("title", "start_date", "end_date")


def sync_project_items(owner):
    """TeamFlow'dagi loyihalar portfolioda avtomatik paydo bo'ladi: a'zo bo'lgan har bir loyiha uchun bitta yozuv.

    A'zolik bir nechta joyda `bulk_create` bilan yaratilgani uchun (signal ishlamaydi) portfolio ochilganda
    yetishmaganlari qo'shiladi. Jamoadan chiqarilsa ham yozuv (baho va videolari bilan) saqlanadi.
    """
    existing = PortfolioItem.objects.filter(owner=owner, project__isnull=False).values("project_id")
    missing = (ProjectMember.objects.filter(developer=owner).exclude(project_id__in=existing)
               .values_list("project_id", flat=True))
    PortfolioItem.objects.bulk_create([PortfolioItem(owner=owner, project_id=pk) for pk in missing],
                                      ignore_conflicts=True)


def _require_owner(user, item):
    if not can_edit_item(user, item):
        raise PermissionDenied("Faqat o'z portfoliongizni o'zgartira olasiz.")


def create_item(user, **data):
    if not user.is_developer:
        raise PermissionDenied("Portfolio faqat dasturchilar uchun.")
    item = PortfolioItem(owner=user, **data)
    item.full_clean()
    item.save()
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
    return review


def delete_review(item, user):
    PortfolioReview.objects.filter(item=item, author=user).delete()


def follow(user, developer):
    if not can_follow(user, developer):
        raise ServiceError("O'zingizni kuzata olmaysiz.")
    try:
        with transaction.atomic():
            Follow.objects.get_or_create(follower=user, developer=developer)
    except IntegrityError:
        pass  # parallel ikki so'rov — kuzatuv baribir bor


def unfollow(user, developer):
    Follow.objects.filter(follower=user, developer=developer).delete()
