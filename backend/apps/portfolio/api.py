"""Portfolio API — yupqa qatlam: kirishni tekshiradi, servis va ko'rsatkichlarni chaqiradi."""
from django.conf import settings
from django.core.cache import cache
from django.db.models import Q
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response

from apps.core.pagination import BoundedPagination

from . import services
from .files import video_response
from .models import Follow, PortfolioImage, PortfolioItem, PortfolioReview, PortfolioVideo
from .permissions import can_follow, portfolio_owners
from .serializers import ItemInput, ReviewInput, developer_review_row, developer_row, my_review_row, rating_row, item_detail, item_row, review_row, video_row
from .stats import DEVELOPER_RANKING_CACHE_KEY, SUMMARY_CACHE_KEY, developer_highlights, developer_technologies, item_work, developers_with_stats, following_count, experience, items_with_stats, recent_tasks, summary, tasks_done_by_project, years


SORTS = {"followers": ("-followers_count",), "projects": ("-projects_count",), "reviews": ("-reviews_count",)}


def _item(pk):
    """Portfolio loyihasi — egasi faol dasturchi bo'lsagina ko'rinadi."""
    return get_object_or_404(items_with_stats().filter(owner__in=portfolio_owners()).select_related("owner")
                             .prefetch_related("images"), pk=pk)


def _item_payload(item, user):
    done = tasks_done_by_project(item.owner, [item.project_id]).get(item.project_id, 0) if item.is_auto else None
    mine = PortfolioReview.objects.filter(item=item, author=user).select_related("author").first()
    return item_detail(item, user, done, mine, item_work(item))


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
    if not q and not only_following and sort is None and specialty is None and "page" not in request.query_params and "page_size" not in request.query_params:
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
        qs = qs.filter(Q(first_name__icontains=q) | Q(last_name__icontains=q) | Q(specialty__name__icontains=q))
    if only_following:
        qs = qs.filter(followers__follower=request.user)
    if specialty is not None:
        qs = qs.filter(specialty_id=specialty)
    if sort:
        qs = qs.order_by(*SORTS[sort], "first_name", "last_name", "pk")
    paginator = BoundedPagination()
    page = paginator.paginate_queryset(qs, request)
    first = (paginator.page.start_index() if paginator.page else 1)
    ranked = not (q or only_following or sort or specialty is not None)
    rows = _rows(page, lambda i: first + i if ranked else None)
    return paginator.get_paginated_response(rows)


@api_view(["GET"])
def developer_detail(request, pk):
    owner = get_object_or_404(portfolio_owners(), pk=pk)
    row = developer_row(developers_with_stats(request.user).get(pk=owner.pk))
    items = list(items_with_stats(owner).order_by("-created_at", "-id"))
    done = tasks_done_by_project(owner, [i.project_id for i in items if i.is_auto])
    items.sort(key=lambda i: (i.period[1] or i.period[0] or i.created_at.date()), reverse=True)
    return Response({
        **row,
        "experience": experience(owner, items),
        "technologies": developer_technologies(items),
        "years": years(owner, items),
        "items": [item_row(i, done.get(i.project_id, 0)) for i in items],
        "recent_tasks": recent_tasks(owner),
        "actions": {"follow": can_follow(request.user, owner), "add": owner.pk == request.user.pk},
    })


@api_view(["GET"])
def developer_reviews(request, pk):
    """Dasturchining barcha loyihalaridagi baho va sharhlari (eng yangisi tepada)."""
    owner = get_object_or_404(portfolio_owners(), pk=pk)
    qs = (PortfolioReview.objects.filter(item__owner=owner).select_related("author", "item__project")
          .order_by("-updated_at", "-id"))
    paginator = BoundedPagination()
    page = paginator.paginate_queryset(qs, request)
    return paginator.get_paginated_response([developer_review_row(r) for r in page])


@api_view(["POST", "DELETE"])
def follow(request, pk):
    developer = get_object_or_404(portfolio_owners(), pk=pk)
    if request.method == "POST":
        services.follow(request.user, developer)
    else:
        services.unfollow(request.user, developer)
    return Response(developer_row(developers_with_stats(request.user).get(pk=developer.pk)))


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


RATING_SORTS = {"new": ("-updated_at", "-id"), "high": ("-stars", "-updated_at", "-id"), "low": ("stars", "-updated_at", "-id")}


@api_view(["GET"])
def ratings(request):
    """Barcha baholar (faqat faol dasturchilar loyihalari). `q` — loyiha yoki dasturchi nomi;
    `sort` — new (standart) | high | low; `mine=1` — faqat o'zim qo'ygan baholar."""
    qs = (PortfolioReview.objects.filter(item__owner__in=portfolio_owners())
          .select_related("author", "item__project", "item__owner"))
    if request.query_params.get("mine") == "1":
        qs = qs.filter(author=request.user)
    q = (request.query_params.get("q") or "").strip()
    if q:
        qs = qs.filter(Q(item__title__icontains=q) | Q(item__project__name__icontains=q)
                       | Q(item__owner__first_name__icontains=q) | Q(item__owner__last_name__icontains=q))
    qs = qs.order_by(*RATING_SORTS.get(request.query_params.get("sort"), RATING_SORTS["new"]))
    paginator = BoundedPagination()
    page = paginator.paginate_queryset(qs, request)
    return paginator.get_paginated_response([rating_row(r) for r in page])


@api_view(["GET", "POST", "DELETE"])
def reviews(request, pk):
    """GET — sahifalangan sharhlar; POST — o'z bahom (bor bo'lsa yangilanadi); DELETE — o'z bahomni o'chirish."""
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


@api_view(["POST", "DELETE"])
@parser_classes([MultiPartParser, FormParser])
def cover(request, pk):
    """Loyiha muqova rasmi (faqat egasi): POST (multipart `cover`) — yuklash/almashtirish, DELETE — o'chirish."""
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
    """Muqova rasmi — faqat tizimga kirganlarga (media papkasi ochiq berilmaydi)."""
    obj = get_object_or_404(PortfolioItem.objects.filter(owner__in=portfolio_owners()), pk=pk)
    if not obj.cover:
        raise Http404
    try:
        handle = obj.cover.open("rb")
    except (FileNotFoundError, ValueError):
        raise Http404
    response = FileResponse(handle, content_type="image/jpeg")
    response["X-Content-Type-Options"] = "nosniff"
    response["Cache-Control"] = "private, max-age=86400"  # `?v=` almashadi — eski rasm keshda qolmaydi
    return response


@api_view(["POST"])
@parser_classes([MultiPartParser, FormParser])
def image_upload(request, pk):
    """Galereyaga rasm (faqat egasi): multipart `image`."""
    obj = _item(pk)
    upload = request.FILES.get("image")
    if upload is None:
        return Response({"detail": "Rasm tanlang.", "fields": {"image": ["Rasm tanlang."]}}, status=400)
    services.add_image(obj, request.user, upload)
    return Response(_item_payload(_item(pk), request.user), status=status.HTTP_201_CREATED)


@api_view(["DELETE"])
def image_delete(request, pk, image_pk):
    obj = _item(pk)
    image = get_object_or_404(PortfolioImage, pk=image_pk, item=obj)
    services.delete_image(image, request.user)
    return Response(_item_payload(_item(pk), request.user))


@api_view(["GET"])
def image_file(request, pk):
    """Galereya rasmi — faqat tizimga kirganlarga (media papkasi ochiq berilmaydi)."""
    image = get_object_or_404(PortfolioImage.objects.select_related("item"), pk=pk, item__owner__in=portfolio_owners())
    try:
        handle = image.file.open("rb")
    except (FileNotFoundError, ValueError):
        raise Http404
    response = FileResponse(handle, content_type="image/jpeg")
    response["X-Content-Type-Options"] = "nosniff"
    response["Cache-Control"] = "private, max-age=86400"  # rasm almashmaydi (o'chirilib yangisi qo'shiladi)
    return response


@api_view(["GET"])
def video_file(request, pk):
    """Video — faqat tizimga kirganlarga (to'g'ridan-to'g'ri media URL berilmaydi)."""
    video = get_object_or_404(PortfolioVideo.objects.select_related("item"), pk=pk,
                              item__owner__in=portfolio_owners())
    try:
        return video_response(request, video)
    except (FileNotFoundError, ValueError):
        raise Http404
