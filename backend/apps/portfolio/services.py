"""Portfolio biznes amallari. Ruxsat qoidalari — `permissions.py`."""
from django.conf import settings
from django.contrib.contenttypes.models import ContentType
from django.db import IntegrityError, transaction
from rest_framework.exceptions import PermissionDenied

from apps.core.api_utils import ServiceError

from apps.core.models import ActivityLog
from apps.core.services import log

from .files import IMAGE_EXTENSIONS, extension, normalized_cover, normalized_image, validate_document, validate_video
from .models import Follow, PortfolioAttachment, PortfolioComment, PortfolioItem, PortfolioReview, PortfolioVideo
from .permissions import can_edit_item, can_follow, can_review_item
from .stats import invalidate_developer_ranking

# Faqat o'zi qo'shgan loyihada o'zgaradigan maydonlar; TeamFlow loyihasida nomi va sanalari loyihadan olinadi.
MANUAL_ONLY_FIELDS = ("title", "start_date", "end_date")


HISTORY_VERB_PREFIX = "portfolio_"


def _require_owner(user, item):
    if not can_edit_item(user, item):
        raise PermissionDenied("Faqat o'z portfoliongizni o'zgartira olasiz.")


def _log(user, verb, text, item):
    """Loyiha tarixiga yozuv (rasm, video, fayl qo'shildi/o'chirildi) — loyihani ochganlarning hammasi ko'radi."""
    log(user, HISTORY_VERB_PREFIX + verb, f"{user.full_name} {text}", item)


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
    _log(user, "cover_set", "muqova rasmini yangiladi", item)
    invalidate_developer_ranking()
    return item


def remove_cover(item, user):
    _require_owner(user, item)
    if item.cover:
        storage, name = item.cover.storage, item.cover.name
        item.cover = ""
        item.save(update_fields=["cover", "updated_at"])
        transaction.on_commit(lambda: storage.delete(name))
        _log(user, "cover_removed", "muqova rasmini o'chirdi", item)
        invalidate_developer_ranking()
    return item


def delete_item(item, user):
    _require_owner(user, item)
    if item.is_auto:
        raise ServiceError("TeamFlow loyihasi portfoliodan o'chirilmaydi.")
    ActivityLog.objects.filter(target_type=ContentType.objects.get_for_model(PortfolioItem), target_id=item.pk).delete()
    item.delete()  # video va fayllar diskdan birga o'chadi (signals.py)
    invalidate_developer_ranking()


def add_video(item, user, file):
    _require_owner(user, item)
    if item.videos.count() >= settings.PORTFOLIO_VIDEOS_PER_ITEM:
        raise ServiceError(f"Bitta loyihaga {settings.PORTFOLIO_VIDEOS_PER_ITEM} tagacha video yuklash mumkin.",
                           field="video")
    validate_video(file)
    video = PortfolioVideo.objects.create(item=item, file=file, original_name=file.name[:255])
    _log(user, "video_added", f"video qo'shdi: {video.original_name[:100]}", item)
    return video


def delete_video(video, user):
    _require_owner(user, video.item)
    _log(user, "video_removed", f"videoni o'chirdi: {video.original_name[:100]}", video.item)
    video.delete()


def add_attachment(item, user, file):
    """Rasm (tarkibi tekshiriladi, JPEG qilib saqlanadi) yoki Word/PDF fayl biriktiradi."""
    _require_owner(user, item)
    if item.attachments.count() >= settings.PORTFOLIO_ATTACHMENTS_PER_ITEM:
        raise ServiceError(f"Bitta loyihaga {settings.PORTFOLIO_ATTACHMENTS_PER_ITEM} tagacha rasm va fayl biriktirish mumkin.",
                           field="file")
    name = file.name
    if extension(name) in IMAGE_EXTENSIONS:
        kind = PortfolioAttachment.IMAGE
        content = normalized_image(file, max_mb=settings.PORTFOLIO_IMAGE_MAX_MB, name="image.jpg")
        file, size = content, content.size
    else:
        kind = PortfolioAttachment.DOCUMENT
        validate_document(file)
        size = file.size
    attachment = PortfolioAttachment.objects.create(item=item, file=file, original_name=name[:255], kind=kind, size=size)
    _log(user, "file_added", f"{'rasm' if kind == PortfolioAttachment.IMAGE else 'fayl'} qo'shdi: {name[:100]}", item)
    return attachment


def delete_attachment(attachment, user):
    _require_owner(user, attachment.item)
    what = "rasmni" if attachment.kind == PortfolioAttachment.IMAGE else "faylni"
    _log(user, "file_removed", f"{what} o'chirdi: {attachment.original_name[:100]}", attachment.item)
    attachment.delete()


def save_review(item, user, *, stars):
    if not can_review_item(user, item):
        raise PermissionDenied("O'z loyihangizni baholay olmaysiz.")
    review, _ = PortfolioReview.objects.update_or_create(item=item, author=user, defaults={"stars": stars})
    invalidate_developer_ranking()
    return review


def delete_review(item, user):
    deleted, _ = PortfolioReview.objects.filter(item=item, author=user).delete()
    if deleted:
        invalidate_developer_ranking()


def add_comment(item, user, *, text):
    """Sharh qo'shadi. Bir foydalanuvchi bitta loyihaga istalgancha sharh yoza oladi."""
    if not can_review_item(user, item):
        raise PermissionDenied("O'z loyihangizga sharh yoza olmaysiz.")
    text = text.strip()
    if not text:
        raise ServiceError("Sharh matnini yozing.", field="text")
    comment = PortfolioComment.objects.create(item=item, author=user, text=text)
    invalidate_developer_ranking()  # kartadagi "So'nggi sharh" yangilansin
    return comment


def delete_comment(comment, user):
    if comment.author_id != user.pk:
        raise PermissionDenied("Faqat o'z sharhingizni o'chira olasiz.")
    comment.delete()
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
