"""Portfolio biznes amallari. Ruxsat qoidalari — `permissions.py`."""
from django.conf import settings
from django.db import IntegrityError, transaction
from django.db.models import Sum
from rest_framework.exceptions import PermissionDenied

from apps.accounts.models import User
from apps.core.api_utils import ServiceError
from apps.core.dates import ensure_not_past
from apps.projects.models import ProjectMember

from .files import normalized_cover, validate_video
from .models import Follow, PortfolioItem, PortfolioReview, PortfolioVideo
from .permissions import can_edit_item, can_follow, can_review_item
from .stats import done_assignments, invalidate_developer_ranking

MB = 1024 * 1024

# Faqat o'zi qo'shgan loyihada o'zgaradigan maydonlar; TeamFlow loyihasida nomi va sanalari loyihadan olinadi.
MANUAL_ONLY_FIELDS = ("title", "start_date", "end_date")


def membership_removed(owner_id, project_id):
    """Dasturchi jamoadan chiqarildi (tranzaksiya tasdiqlangach chaqiriladi, `signals.py`).

    Shu loyihada bajargan vazifasi bo'lsa — yozuv portfolioda qoladi (portfolio hali ochilmagan bo'lsa ham
    yaratiladi). Bo'lmasa — yozuv videolari va baholari bilan o'chiriladi: xato bilan qo'shilgan loyiha
    portfolioda qolib ketmasin. Natija portfolio ochilgan-ochilmaganiga bog'liq emas.
    """
    if ProjectMember.objects.filter(developer_id=owner_id, project_id=project_id).exists():
        return  # qayta qo'shilgan
    if done_assignments().filter(developer_id=owner_id, task__project_id=project_id).exists():
        PortfolioItem.objects.bulk_create([PortfolioItem(owner_id=owner_id, project_id=project_id)],
                                          ignore_conflicts=True)
        return
    with transaction.atomic():  # video fayllari tasdiqdan keyin o'chadi (signals.py)
        for item in PortfolioItem.objects.filter(owner_id=owner_id, project_id=project_id):
            item.delete()
    invalidate_developer_ranking()


def _require_owner(user, item):
    if not can_edit_item(user, item):
        raise PermissionDenied("Faqat o'z portfoliongizni o'zgartira olasiz.")


def create_item(user, **data):
    if not user.is_developer:
        raise PermissionDenied("Portfolio faqat dasturchilar uchun.")
    ensure_not_past(data.get("start_date"), "start_date")
    ensure_not_past(data.get("end_date"), "end_date")
    item = PortfolioItem(owner=user, **data)
    item.full_clean()
    item.save()
    invalidate_developer_ranking()
    return item


def update_item(item, user, **data):
    _require_owner(user, item)
    if item.is_auto and any(field in data for field in MANUAL_ONLY_FIELDS):
        raise ServiceError("TeamFlow loyihasining nomi va sanalari loyihadan olinadi, ularni o'zgartirib bo'lmaydi.")
    # Faqat yangi kiritilgan yoki o'zgargan sana tekshiriladi (eski yozuvni nom/izoh bilan saqlash mumkin)
    ensure_not_past(data.get("start_date"), "start_date", item.start_date)
    ensure_not_past(data.get("end_date"), "end_date", item.end_date)
    for field, value in data.items():
        setattr(item, field, value)
    item.full_clean()
    item.save()
    invalidate_developer_ranking()
    return item


def set_cover(item, user, upload):
    _require_owner(user, item)
    content = normalized_cover(upload)
    old_storage = item.cover.storage if item.cover else None
    old_name = item.cover.name if item.cover else ""
    item.cover.save(content.name, content, save=False)
    item.save(update_fields=["cover", "updated_at"])
    if old_storage and old_name:
        transaction.on_commit(lambda: old_storage.delete(old_name))
    invalidate_developer_ranking()
    return item


def remove_cover(item, user):
    _require_owner(user, item)
    if item.cover:
        storage, name = item.cover.storage, item.cover.name
        item.cover = ""
        item.save(update_fields=["cover", "updated_at"])
        transaction.on_commit(lambda: storage.delete(name))
        invalidate_developer_ranking()
    return item


def delete_item(item, user):
    _require_owner(user, item)
    if item.is_auto:
        raise ServiceError("TeamFlow loyihasi portfoliodan o'chirilmaydi.")
    item.delete()  # videolar fayli bilan birga o'chadi (signals.py)
    invalidate_developer_ranking()


@transaction.atomic
def add_video(item, user, file):
    _require_owner(user, item)
    validate_video(file)
    # Egasi qatori qulflanadi: bir vaqtdagi ikki yuklash soni va kvota chegarasidan o'tib ketmasin.
    User.objects.select_for_update().filter(pk=item.owner_id).first()
    if item.videos.count() >= settings.PORTFOLIO_VIDEOS_PER_ITEM:
        raise ServiceError(f"Bitta loyihaga {settings.PORTFOLIO_VIDEOS_PER_ITEM} tagacha video yuklash mumkin.",
                           field="video")
    used = PortfolioVideo.objects.filter(item__owner_id=item.owner_id).aggregate(n=Sum("size"))["n"] or 0
    if used + file.size > settings.PORTFOLIO_VIDEO_QUOTA_MB * MB:
        raise ServiceError(
            f"Videolar uchun joy {settings.PORTFOLIO_VIDEO_QUOTA_MB} MB, {used / MB:.0f} MB band. "
            "Keraksiz videoni o'chiring yoki kichikroq video yuklang.", field="video")
    return PortfolioVideo.objects.create(item=item, file=file, original_name=file.name[:255], size=file.size)


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
