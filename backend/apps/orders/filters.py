"""Buyurtma ro'yxati filtrlari va Boshqarma bosh paneli hisob-kitobi — BITTA joyda.

Bosh paneldagi karta soni va karta bosilganda chiqadigan ro'yxat bir xil `apply_order_bucket` dan foydalanadi.
"""
from django.db.models import Count, Q

from apps.core.periods import PERIOD_KEYS, period_cards, period_starts

from .models import Order

S = Order.Status
APPROVED = [S.APPROVED, S.PROJECT_CREATED]  # loyihaga aylangani ham tasdiqlangan
BUCKETS = ("sent", "rejected", "approved")


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
    return qs


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
