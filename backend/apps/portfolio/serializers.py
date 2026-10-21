"""Portfolio kirish validatsiyasi va chiqish shakli."""
from django.core.validators import URLValidator
from rest_framework import serializers

from apps.core.api_utils import avatar_url, user_brief

from .permissions import can_edit_item, can_review_item
from .stats import round_rating
from .technologies import normalize_technologies
from .files import cover_url


class ItemInput(serializers.Serializer):
    title = serializers.CharField(max_length=255, required=False, allow_blank=True)
    description = serializers.CharField(max_length=2000, required=False, allow_blank=True)
    link = serializers.URLField(max_length=500, required=False, allow_blank=True,
                                validators=[URLValidator(schemes=["http", "https"])])
    start_date = serializers.DateField(required=False, allow_null=True)
    end_date = serializers.DateField(required=False, allow_null=True)
    technologies = serializers.JSONField(required=False)

    def validate_title(self, value):
        return value.strip()

    def validate_technologies(self, value):
        try:
            return normalize_technologies(value)
        except ValueError as exc:
            raise serializers.ValidationError(str(exc)) from exc


class ReviewInput(serializers.Serializer):
    stars = serializers.IntegerField(min_value=1, max_value=5)


class CommentInput(serializers.Serializer):
    text = serializers.CharField(max_length=1000)


def developer_row(user, rank=None, highlights=None):
    highlights = highlights or {}
    return {
        "projects": highlights.get("projects", []), "projects_extra": highlights.get("projects_extra", 0),
        "experience_months": highlights.get("experience_months"),
        "status": highlights.get("status") or {"state": "free", "active_tasks": 0, "trip_return_date": None},
        "technologies": highlights.get("technologies", []), "cover": highlights.get("cover"),
        "working_on": highlights.get("working_on"), "latest_comment": highlights.get("latest_comment"),
        "id": user.pk, "full_name": user.full_name, "role": user.role, "department_name": user.department_name,
        "avatar": avatar_url(user), "specialty": user.specialty.name if user.specialty else "",
        "bio": user.bio, "email": user.email, "telegram_username": user.telegram_username,
        "rating": round_rating(user.rating), "reviews_count": user.reviews_count,
        "followers_count": user.followers_count, "projects_count": user.projects_count,
        "tasks_done": user.tasks_done, "is_following": user.is_following, "rank": rank,
    }


def item_row(item, tasks_done=None):
    start, end = item.period
    project = item.project
    return {
        "id": item.pk, "is_auto": item.is_auto, "title": item.display_title, "link": item.link,
        "technologies": item.technologies, "cover": cover_url(item),
        "start_date": start, "end_date": end,
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


def attachment_row(attachment):
    return {"id": attachment.pk, "name": attachment.original_name, "kind": attachment.kind, "size": attachment.size,
            "url": f"/api/portfolio/attachments/{attachment.pk}/", "created_at": attachment.created_at}


def history_row(entry):
    return {"id": entry.pk, "verb": entry.verb, "message": entry.message, "created_at": entry.created_at}


def review_row(review):
    return {"id": review.pk, "author": user_brief(review.author), "stars": review.stars,
            "created_at": review.created_at, "updated_at": review.updated_at}


def comment_row(comment, user):
    return {"id": comment.pk, "author": user_brief(comment.author), "text": comment.text,
            "created_at": comment.created_at, "can_delete": comment.author_id == user.pk}


def developer_review_row(review):
    return {
        **review_row(review),
        "item": {"id": review.item_id, "title": review.item.display_title},
    }


def my_review_row(review):
    owner = review.item.owner
    return {"id": review.pk, "item_id": review.item_id, "item_title": review.item.display_title,
            "developer": {"id": owner.pk, "full_name": owner.full_name}, "stars": review.stars,
            "updated_at": review.updated_at}


def item_detail(item, user, tasks_done, my_review):
    editable = can_edit_item(user, item)
    return {
        **item_row(item, tasks_done),
        "description": item.description,
        "manual": {"title": item.title, "start_date": item.start_date, "end_date": item.end_date},
        "owner": user_brief(item.owner),
        "videos": [video_row(v) for v in item.videos.all()],
        "attachments": [attachment_row(a) for a in item.attachments.all()],
        "my_review": review_row(my_review) if my_review else None,
        "actions": {"edit": editable, "delete": editable and not item.is_auto, "upload": editable,
                    "review": can_review_item(user, item)},
    }
