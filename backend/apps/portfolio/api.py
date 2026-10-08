"""Portfolio API — yupqa qatlam: kirishni tekshiradi, servis va ko'rsatkichlarni chaqiradi."""
from django.db.models import Q
from django.http import Http404
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.decorators import api_view, parser_classes, throttle_classes
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle

from apps.core.pagination import BoundedPagination

from . import services
from .files import video_response
from .models import PortfolioReview, PortfolioVideo
from .permissions import can_follow, portfolio_owners
from .serializers import ItemInput, ReviewInput, developer_row, item_detail, item_row, review_row, video_row
from .stats import developers_with_stats, experience, items_with_stats, recent_tasks, tasks_done_by_project, years


def _item(pk):
    """Portfolio loyihasi — egasi faol dasturchi bo'lsagina ko'rinadi."""
    return get_object_or_404(items_with_stats().filter(owner__in=portfolio_owners()).select_related("owner"), pk=pk)


def _item_payload(item, user):
    done = tasks_done_by_project(item.owner, [item.project_id]).get(item.project_id, 0) if item.is_auto else None
    mine = PortfolioReview.objects.filter(item=item, author=user).select_related("author").first()
    return item_detail(item, user, done, mine)


@api_view(["GET"])
def developer_list(request):
    """Barcha dasturchilar reyting bo'yicha (eng balandi tepada). `q` — ism, familiya yoki mutaxassislik."""
    qs = developers_with_stats(request.user)
    q = request.query_params.get("q", "").strip()[:200]
    if q:
        qs = qs.filter(Q(first_name__icontains=q) | Q(last_name__icontains=q) | Q(specialty__name__icontains=q))
    paginator = BoundedPagination()
    page = paginator.paginate_queryset(qs, request)
    first = (paginator.page.start_index() if paginator.page else 1)
    rows = [developer_row(u, None if q else first + i) for i, u in enumerate(page)]
    return paginator.get_paginated_response(rows)


@api_view(["GET"])
def developer_detail(request, pk):
    owner = get_object_or_404(portfolio_owners(), pk=pk)
    services.sync_project_items(owner)
    row = developer_row(developers_with_stats(request.user).get(pk=owner.pk))
    items = list(items_with_stats(owner).order_by("-created_at", "-id"))
    done = tasks_done_by_project(owner, [i.project_id for i in items if i.is_auto])
    items.sort(key=lambda i: (i.period[1] or i.period[0] or i.created_at.date()), reverse=True)
    return Response({
        **row,
        "experience": experience(owner, items),
        "years": years(owner, items),
        "items": [item_row(i, done.get(i.project_id, 0)) for i in items],
        "recent_tasks": recent_tasks(owner),
        "actions": {"follow": can_follow(request.user, owner), "add": owner.pk == request.user.pk},
    })


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


class UploadThrottle(UserRateThrottle):
    """Video yuklash tezligi cheklanadi (umumiy joy chegarasi — `services.add_video`)."""

    scope = "portfolio_upload"


@api_view(["POST"])
@parser_classes([MultiPartParser, FormParser, JSONParser])
@throttle_classes([UploadThrottle])
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


@api_view(["GET"])
def video_file(request, pk):
    """Video — faqat tizimga kirganlarga (to'g'ridan-to'g'ri media URL berilmaydi)."""
    video = get_object_or_404(PortfolioVideo.objects.select_related("item"), pk=pk,
                              item__owner__in=portfolio_owners())
    try:
        return video_response(request, video)
    except (FileNotFoundError, ValueError):
        raise Http404
