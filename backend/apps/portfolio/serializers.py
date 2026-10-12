"""Portfolio kirish validatsiyasi va chiqish shakli."""
from django.core.validators import URLValidator
from django.utils.text import Truncator
from rest_framework import serializers

from apps.core.api_utils import avatar_url, user_brief
from apps.core.technologies import TechnologiesField

from .permissions import can_edit_item, can_review_item
from .stats import item_status, round_rating

SUMMARY_CHARS = 200  # ro'yxat kartasidagi qisqa tavsif; to'liq matn loyiha oynasida


def cover_url(item):
    if not item.cover:
        return None
    version = item.cover.name.rsplit("/", 1)[-1].split(".")[0][:12]
    return f"/api/portfolio/covers/{item.pk}/?v={version}"


class ItemInput(serializers.Serializer):
    title = serializers.CharField(max_length=255, required=False, allow_blank=True)
    description = serializers.CharField(max_length=2000, required=False, allow_blank=True)
    link = serializers.URLField(max_length=500, required=False, allow_blank=True,
                                validators=[URLValidator(schemes=["http", "https"])])
    start_date = serializers.DateField(required=False, allow_null=True)
    end_date = serializers.DateField(required=False, allow_null=True)
    technologies = TechnologiesField(required=False)

    def validate_title(self, value):
        return value.strip()


class ReviewInput(serializers.Serializer):
    stars = serializers.IntegerField(min_value=1, max_value=5)
    text = serializers.CharField(max_length=1000, required=False, allow_blank=True, default="")


def developer_row(user, rank=None, highlights=None):
    highlights = highlights or {}
    return {
        "projects": highlights.get("projects", []), "projects_extra": highlights.get("projects_extra", 0),
        "experience_months": highlights.get("experience_months"),
        "id": user.pk, "full_name": user.full_name, "role": user.role, "department_name": user.department_name,
        "avatar": avatar_url(user), "specialty": user.specialty.name if user.specialty else "",
        "rating": round_rating(user.rating), "reviews_count": user.reviews_count,
        "followers_count": user.followers_count, "projects_count": user.projects_count,
        "tasks_done": user.tasks_done, "is_following": user.is_following, "rank": rank,
    }


def item_row(item, tasks_done=None):
    start, end = item.period
    project = item.project
    return {
        "id": item.pk, "is_auto": item.is_auto, "title": item.display_title, "link": item.link,
        "start_date": start, "end_date": end, "status": item_status(item),
        "summary": Truncator(item.description).chars(SUMMARY_CHARS), "technologies": item.technologies,
        "cover": cover_url(item),
        "project": {"code": project.code, "stage": project.stage} if project else None,
        "tasks_done": tasks_done if item.is_auto else None,
        "rating": round_rating(item.rating), "reviews_count": item.reviews_count, "videos_count": item.videos_count,
    }


def video_row(video):
    try:
        size = video.file.size
    except (OSError, ValueError):
        size = None
    return {"id": video.pk, "name": video.original_name, "size": size, "url": f"/api/portfolio/videos/{video.pk}/"}


def review_row(review):
    return {"id": review.pk, "author": user_brief(review.author), "stars": review.stars, "text": review.text,
            "created_at": review.created_at, "updated_at": review.updated_at}


def developer_review_row(review):
    """Dasturchining barcha loyihalaridagi sharhlar: qaysi loyiha uchunligi bilan."""
    return {**review_row(review), "item_id": review.item_id, "item_title": review.item.display_title}


def my_review_row(review):
    owner = review.item.owner
    return {"id": review.pk, "item_id": review.item_id, "item_title": review.item.display_title,
            "developer": {"id": owner.pk, "full_name": owner.full_name}, "stars": review.stars,
            "text": review.text, "updated_at": review.updated_at}


def rating_row(review):
    """Baholar ro'yxati: kim, qaysi loyiha va dasturchini, necha yulduz, qanday sharh bilan baholagan."""
    owner = review.item.owner
    return {**review_row(review), "item_id": review.item_id, "item_title": review.item.display_title,
            "developer": {"id": owner.pk, "full_name": owner.full_name}}


def image_row(image):
    return {"id": image.pk, "url": f"/api/portfolio/images/{image.pk}/"}


def work_row(work):
    """TeamFlow loyihasi: mas'ul, jarayon, egasi bajargan ishlar va jamoa (o'zi qo'shgan loyihada — None)."""
    if work is None:
        return None
    return {
        "lead": user_brief(work["lead"]), "progress": {"total": work["total"], "done": work["done"]},
        "completed_tasks": [{"id": t.pk, "title": t.title, "completed_at": t.completed_at} for t in work["completed"]],
        "team": [user_brief(u) for u in work["team"]],
    }


def item_detail(item, user, tasks_done, my_review, work=None):
    editable = can_edit_item(user, item)
    return {
        **item_row(item, tasks_done),
        "images": [image_row(i) for i in item.images.all()],
        "work": work_row(work),
        "description": item.description,
        "manual": {"title": item.title, "start_date": item.start_date, "end_date": item.end_date},
        "owner": user_brief(item.owner),
        "videos": [video_row(v) for v in item.videos.all()],
        "my_review": review_row(my_review) if my_review else None,
        "actions": {"edit": editable, "delete": editable and not item.is_auto, "upload": editable,
                    "review": can_review_item(user, item)},
    }
