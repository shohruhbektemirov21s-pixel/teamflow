"""Buyurtma ro'yxati filtrlari va Boshqarma bosh paneli hisob-kitobi — BITTA joyda.

Bosh paneldagi karta soni va karta bosilganda chiqadigan ro'yxat bir xil `apply_order_bucket` dan foydalanadi.
"""
from datetime import timedelta

from django.db.models import Count, Q
from django.utils import timezone
from django.utils.dateparse import parse_date

from apps.core.periods import PERIOD_KEYS, period_cards, period_starts
from apps.core.trends import stats_block

from .models import Order

S = Order.Status
APPROVED = [S.APPROVED, S.PROJECT_CREATED]  # loyihaga aylangani ham tasdiqlangan
BUCKETS = ("sent", "rejected", "approved")
DUE_SOON_DAYS = 7


def order_bucket_condition(bucket, since=None):
    """sent — shu davrda yuborilgan (holatidan qat'i nazar); rejected / approved — shu davrda shu qaror chiqqan
    (hozir ham shu holatda)."""
    condition = Q()
    if bucket == "rejected":
        condition &= Q(status=S.REJECTED)
    elif bucket == "approved":
        condition &= Q(status__in=APPROVED)
    if since is not None:
        condition &= Q(created_at__gte=since) if bucket == "sent" else Q(decided_at__gte=since)
    return condition


def apply_order_bucket(qs, bucket, since=None):
    return qs.filter(order_bucket_condition(bucket, since))


def filter_orders(qs, params):
    """GET: ?period=week&bucket=rejected (bosh panel kartasi)."""
    if params.get("bucket") in BUCKETS:
        since = period_starts()[params["period"]] if params.get("period") in PERIOD_KEYS else None
        qs = apply_order_bucket(qs, params["bucket"], since)
    if params.get("due_soon") == "1":
        qs = qs.filter(due_soon_condition())
    if params.get("stage"):
        qs = qs.filter(project__stage__in=params["stage"].split(","))
    if params.get("priority"):
        qs = qs.filter(priority__in=params["priority"].split(","))
    if params.get("department"):
        qs = qs.filter(submitted_by__department_name=params["department"])
    # Yuborilgan sana oralig'i (ikkala kun ham kiradi); noto'g'ri sana e'tiborga olinmaydi
    sent_from, sent_to = parse_date(params.get("sent_from") or ""), parse_date(params.get("sent_to") or "")
    if sent_from:
        qs = qs.filter(created_at__date__gte=sent_from)
    if sent_to:
        qs = qs.filter(created_at__date__lte=sent_to)
    return qs


def orders_stats(qs):
    """Buyurtmalar sahifasi tepasidagi kartalar va holat tugmalaridagi sonlar (ko'rinadigan buyurtmalar bo'yicha).

    Rejalashtirilgan / Yakunlangan — loyihasining darajasi bo'yicha; Shoshilinch — hali yopilmagan shoshilinchlar."""
    open_urgent = Q(priority="urgent") & ~Q(status=S.REJECTED) & ~Q(project__stage="done")
    metrics = {
        "all": (Q(), "created_at"),
        "submitted": (Q(status=S.SUBMITTED), "created_at"),
        "planned": (Q(project__stage="planned"), "created_at"),
        "done": (Q(project__stage="done"), "created_at"),
        "urgent": (open_urgent, "created_at"),
    }
    tabs = {
        "all": Q(),
        "submitted": Q(status=S.SUBMITTED),
        "approved": Q(status__in=APPROVED),
        "rejected": Q(status=S.REJECTED),
        "done": Q(project__stage="done"),
    }
    return stats_block(qs, metrics, tabs)


def due_soon_condition():
    """"Muddati yaqin": so'ralgan muddat {DUE_SOON_DAYS} kun ichida (o'tib ketgani ham). Rad etilgan va loyihasi
    yakunlangan buyurtmada muddat dolzarb emas."""
    limit = timezone.localdate() + timedelta(days=DUE_SOON_DAYS)
    return Q(requested_due_date__lte=limit) & ~Q(status=S.REJECTED) & ~Q(project__stage="done")


def department_dashboard(qs):
    periods = period_cards(lambda since: {
        b: Count("pk", filter=order_bucket_condition(b, since), distinct=True) for b in BUCKETS
    })
    totals = {"submitted": Q(status=S.SUBMITTED), "rejected": Q(status=S.REJECTED), "approved": Q(status__in=APPROVED)}
    aggregates = {f"total_{b}": Count("pk", filter=condition, distinct=True) for b, condition in totals.items()}
    aggregates.update({f"{p['key']}_{b}": count for p in periods for b, count in p["counts"].items()})
    counts = qs.aggregate(**aggregates)
    for p in periods:
        p["counts"] = {b: counts[f"{p['key']}_{b}"] for b in p["counts"]}
    return {
        "orders": {b: counts[f"total_{b}"] for b in totals},
        "periods": periods,
    }
