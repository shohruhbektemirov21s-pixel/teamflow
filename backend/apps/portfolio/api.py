"""Portfolio API — yupqa qatlam: kirishni tekshiradi, servis va ko'rsatkichlarni chaqiradi."""
from django.conf import settings
from django.contrib.contenttypes.models import ContentType
from django.core.cache import cache
from django.db.models import Q
from django.http import Http404
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from apps.core.models import ActivityLog
from apps.core.pagination import BoundedPagination
from apps.core.serving import protected_file

from . import services
from .files import attachment_response, video_response
from .models import Follow, PortfolioAttachment, PortfolioComment, PortfolioItem, PortfolioReview, PortfolioVideo
from .permissions import can_follow, portfolio_owners
from .serializers import (
    CommentInput, ItemInput, ReviewInput, attachment_row, comment_row, developer_review_row, history_row, developer_row, my_review_row,
    item_detail, item_row, review_row, video_row,
)
from .stats import (
    DEVELOPER_RANKING_CACHE_KEY, STATES, SUMMARY_CACHE_KEY, current_projects, developer_highlights, developers_with_stats, experience,
    filter_by_search, filter_by_status, filter_by_technology, following_count, items_with_stats, recent_tasks, summary,
    tasks_done_by_project, years,
)


SORTS = {"followers": ("-followers_count",), "projects": ("-projects_count",), "reviews": ("-reviews_count",)}


def _item(pk):
    """Portfolio loyihasi — egasi faol dasturchi bo'lsagina ko'rinadi."""
    return get_object_or_404(items_with_stats().filter(owner__in=portfolio_owners()).select_related("owner"), pk=pk)


def _item_payload(item, user):
    done = tasks_done_by_project(item.owner, [item.project_id]).get(item.project_id, 0) if item.is_auto else None
    mine = PortfolioReview.objects.filter(item=item, author=user).select_related("author").first()
    return item_detail(item, user, done, mine)


def _rows(users, rank_of):
    users = list(users)
    highlights = developer_highlights(users)
    return [developer_row(u, rank_of(i), highlights[u.pk]) for i, u in enumerate(users)]


@api_view(["GET"])
def developer_list(request):
    """Barcha dasturchilar reyting bo'yicha (eng balandi tepada). `q` — ism, familiya yoki mutaxassislik; `following=1` — faqat kuzatayotganlarim."""
    q = request.query_params.get("q", "").strip()[:200]
    only_following = request.query_params.get("following") == "1"
    sort = request.query_params.get("sort") if request.query_params.get("sort") in SORTS else None
    specialty = request.query_params.get("specialty", "")
    specialty = int(specialty) if specialty.isdigit() else None
    technology = request.query_params.get("technology", "").strip()[:60]
    state = request.query_params.get("status") if request.query_params.get("status") in STATES else None
    min_rating = request.query_params.get("min_rating", "")
    min_rating = int(min_rating) if min_rating in ("1", "2", "3", "4", "5") else None
    filtered = bool(q or only_following or specialty is not None or technology or state or min_rating)
    if not filtered and sort is None and "page" not in request.query_params and "page_size" not in request.query_params:
        payload = cache.get(DEVELOPER_RANKING_CACHE_KEY)
        if payload is None:
            paginator = BoundedPagination()
            page = paginator.paginate_queryset(developers_with_stats(None), request)
            payload = {
                "count": paginator.page.paginator.count,
                "rows": _rows(page, lambda i: paginator.page.start_index() + i),
            }
            cache.set(DEVELOPER_RANKING_CACHE_KEY, payload, settings.PORTFOLIO_RANKING_CACHE_SECONDS)
        developer_ids = [row["id"] for row in payload["rows"]]
        following = set(Follow.objects.filter(follower=request.user.pk, developer_id__in=developer_ids)
                        .values_list("developer_id", flat=True))
        rows = [{**row, "is_following": row["id"] in following} for row in payload["rows"]]
        next_link = f"{request.path}?page=2" if payload["count"] > len(rows) else None
        return Response({"count": payload["count"], "next": next_link, "previous": None, "results": rows})

    qs = developers_with_stats(request.user)
    if q:
        qs = filter_by_search(qs, q)
    if only_following:
        qs = qs.filter(followers__follower=request.user)
    if specialty is not None:
        qs = qs.filter(specialty_id=specialty)
    if technology:
        qs = filter_by_technology(qs, technology)
    if state:
        qs = filter_by_status(qs, state)
    if min_rating:
        qs = qs.filter(rating__gte=min_rating)
    if sort:
        qs = qs.order_by(*SORTS[sort], "first_name", "last_name", "pk")
    paginator = BoundedPagination()
    page = paginator.paginate_queryset(qs, request)
    first = (paginator.page.start_index() if paginator.page else 1)
    ranked = not (filtered or sort)
    rows = _rows(page, lambda i: first + i if ranked else None)
    return paginator.get_paginated_response(rows)


@api_view(["GET"])
def developer_detail(request, pk):
    owner = get_object_or_404(portfolio_owners(), pk=pk)
    highlights = developer_highlights([owner])[owner.pk]
    row = developer_row(developers_with_stats(request.user).get(pk=owner.pk), highlights=highlights)
    items = list(items_with_stats(owner).order_by("-created_at", "-id"))
    done = tasks_done_by_project(owner, [i.project_id for i in items if i.is_auto])
    items.sort(key=lambda i: (i.period[1] or i.period[0] or i.created_at.date()), reverse=True)
    reviews = (PortfolioReview.objects.filter(item__owner=owner)
               .select_related("author", "item__project").order_by("-updated_at", "-id")[:50])
    return Response({
        **row,
        "experience": experience(owner, items),
        "years": years(owner, items),
        "items": [item_row(i, done.get(i.project_id, 0)) for i in items],
        "reviews": [developer_review_row(review) for review in reviews],
        "recent_tasks": recent_tasks(owner),
        "current_projects": current_projects(owner),
        "actions": {"follow": can_follow(request.user, owner), "add": owner.pk == request.user.pk},
    })


@api_view(["POST", "DELETE"])
def follow(request, pk):
    developer = get_object_or_404(portfolio_owners(), pk=pk)
    if request.method == "POST":
        services.follow(request.user, developer)
    else:
        services.unfollow(request.user, developer)
    highlights = developer_highlights([developer])[developer.pk]
    return Response(developer_row(developers_with_stats(request.user).get(pk=developer.pk), highlights=highlights))


@api_view(["POST"])
def item_create(request):
    s = ItemInput(data=request.data)
    s.is_valid(raise_exception=True)
    item = services.create_item(request.user, **s.validated_data)
    return Response(_item_payload(_item(item.pk), request.user), status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH", "DELETE"])
def item(request, pk):
    obj = _item(pk)
    if request.method == "DELETE":
        services.delete_item(obj, request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)
    if request.method == "PATCH":
        s = ItemInput(data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        services.update_item(obj, request.user, **s.validated_data)
        obj = _item(pk)
    return Response(_item_payload(obj, request.user))


@api_view(["GET"])
def developers_summary(request):
    """Umumiy ko'rsatkichlar (jami dasturchilar, o'rtacha reyting, baholangan loyihalar) va mutaxassisliklar."""
    payload = cache.get(SUMMARY_CACHE_KEY)
    if payload is None:
        payload = summary()
        cache.set(SUMMARY_CACHE_KEY, payload, settings.PORTFOLIO_RANKING_CACHE_SECONDS)
    return Response({**payload, "following": following_count(request.user)})


@api_view(["GET"])
def my_reviews(request):
    """Men qo'ygan baholar (eng yangisi tepada)."""
    qs = (PortfolioReview.objects.filter(author=request.user, item__owner__in=portfolio_owners())
          .select_related("item__project", "item__owner").order_by("-updated_at", "-id"))
    paginator = BoundedPagination()
    page = paginator.paginate_queryset(qs, request)
    return paginator.get_paginated_response([my_review_row(r) for r in page])


@api_view(["GET", "POST", "DELETE"])
def reviews(request, pk):
    """GET — sahifalangan baholar; POST — o'z bahom (bor bo'lsa yangilanadi); DELETE — o'z bahomni o'chirish."""
    obj = _item(pk)
    if request.method == "GET":
        paginator = BoundedPagination()
        page = paginator.paginate_queryset(obj.reviews.select_related("author").order_by("-updated_at", "-id"), request)
        return paginator.get_paginated_response([review_row(r) for r in page])
    if request.method == "POST":
        s = ReviewInput(data=request.data)
        s.is_valid(raise_exception=True)
        services.save_review(obj, request.user, **s.validated_data)
    else:
        services.delete_review(obj, request.user)
    return Response(_item_payload(_item(pk), request.user))


@api_view(["GET", "POST"])
def comments(request, pk):
    """GET — sahifalangan sharhlar (eng yangisi tepada, hamma ko'radi); POST — yangi sharh (istalgancha)."""
    obj = _item(pk)
    if request.method == "POST":
        s = CommentInput(data=request.data)
        s.is_valid(raise_exception=True)
        comment = services.add_comment(obj, request.user, **s.validated_data)
        return Response(comment_row(comment, request.user), status=status.HTTP_201_CREATED)
    paginator = BoundedPagination()
    page = paginator.paginate_queryset(obj.comments.select_related("author").order_by("-created_at", "-id"), request)
    return paginator.get_paginated_response([comment_row(c, request.user) for c in page])


@api_view(["DELETE"])
def comment_delete(request, pk, comment_pk):
    obj = _item(pk)
    comment = get_object_or_404(PortfolioComment, pk=comment_pk, item=obj)
    services.delete_comment(comment, request.user)
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["POST"])
@parser_classes([MultiPartParser, FormParser, JSONParser])
def video_upload(request, pk):
    obj = _item(pk)
    file = request.FILES.get("video")
    if file is None:
        return Response({"detail": "Video tanlang.", "fields": {"video": ["Video tanlang."]}}, status=400)
    video = services.add_video(obj, request.user, file)
    return Response(video_row(video), status=status.HTTP_201_CREATED)


@api_view(["DELETE"])
def video_delete(request, pk, video_pk):
    obj = _item(pk)
    video = get_object_or_404(PortfolioVideo, pk=video_pk, item=obj)
    services.delete_video(video, request.user)
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["POST"])
@parser_classes([MultiPartParser, FormParser])
def attachment_upload(request, pk):
    obj = _item(pk)
    file = request.FILES.get("file")
    if file is None:
        return Response({"detail": "Fayl tanlang.", "fields": {"file": ["Fayl tanlang."]}}, status=400)
    attachment = services.add_attachment(obj, request.user, file)
    return Response(attachment_row(attachment), status=status.HTTP_201_CREATED)


@api_view(["DELETE"])
def attachment_delete(request, pk, attachment_pk):
    obj = _item(pk)
    attachment = get_object_or_404(PortfolioAttachment, pk=attachment_pk, item=obj)
    services.delete_attachment(attachment, request.user)
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(["GET"])
def attachment_file(request, pk):
    """Rasm/fayl — faqat tizimga kirganlarga (to'g'ridan-to'g'ri media URL berilmaydi)."""
    attachment = get_object_or_404(PortfolioAttachment.objects.select_related("item"), pk=pk,
                                   item__owner__in=portfolio_owners())
    try:
        return attachment_response(attachment)
    except (FileNotFoundError, ValueError):
        raise Http404


@api_view(["GET"])
def history(request, pk):
    """Loyiha tarixi: rasm, video va fayl qachon, kim tomonidan qo'shilgani/o'chirilgani (eng yangisi tepada)."""
    obj = _item(pk)
    entries = ActivityLog.objects.filter(
        target_type=ContentType.objects.get_for_model(PortfolioItem), target_id=obj.pk,
        verb__startswith=services.HISTORY_VERB_PREFIX).order_by("-created_at", "-id")
    paginator = BoundedPagination()
    page = paginator.paginate_queryset(entries, request)
    return paginator.get_paginated_response([history_row(e) for e in page])


@api_view(["GET"])
def video_file(request, pk):
    """Video — faqat tizimga kirganlarga (to'g'ridan-to'g'ri media URL berilmaydi)."""
    video = get_object_or_404(PortfolioVideo.objects.select_related("item"), pk=pk,
                              item__owner__in=portfolio_owners())
    try:
        return video_response(request, video)
    except (FileNotFoundError, ValueError):
        raise Http404


@api_view(["POST", "DELETE"])
@parser_classes([MultiPartParser, FormParser])
def cover(request, pk):
    obj = _item(pk)
    if request.method == "DELETE":
        services.remove_cover(obj, request.user)
    else:
        upload = request.FILES.get("cover")
        if upload is None:
            return Response({"detail": "Rasm tanlang.", "fields": {"cover": ["Rasm tanlang."]}}, status=400)
        services.set_cover(obj, request.user, upload)
    return Response(_item_payload(_item(pk), request.user))


@api_view(["GET"])
def cover_file(request, pk):
    """Portfolio muqovasi faqat tizimga kirgan foydalanuvchilarga beriladi."""
    obj = get_object_or_404(PortfolioItem.objects.filter(owner__in=portfolio_owners()), pk=pk)
    if not obj.cover:
        raise Http404
    try:
        return protected_file(obj.cover, content_type="image/jpeg", cache_control="private, max-age=86400")
    except (FileNotFoundError, ValueError):
        raise Http404
