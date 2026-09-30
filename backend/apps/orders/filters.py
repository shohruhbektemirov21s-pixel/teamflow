"""Buyurtma ro'yxati filtrlari va Boshqarma bosh paneli hisob-kitobi — BITTA joyda.

Bosh paneldagi karta soni va karta bosilganda chiqadigan ro'yxat bir xil `apply_order_bucket` dan foydalanadi.
"""
from apps.core.periods import PERIOD_KEYS, period_cards, period_starts

from .models import Order

S = Order.Status
APPROVED = [S.APPROVED, S.PROJECT_CREATED]  # loyihaga aylangani ham tasdiqlangan
BUCKETS = ("sent", "rejected", "approved")


def apply_order_bucket(qs, bucket, since=None):
    """sent — shu davrda yuborilgan (holatidan qat'i nazar); rejected / approved — shu davrda shu qaror chiqqan
    (hozir ham shu holatda)."""
    if bucket == "rejected":
        qs = qs.filter(status=S.REJECTED)
    elif bucket == "approved":
        qs = qs.filter(status__in=APPROVED)
    if since is not None:
        qs = qs.filter(created_at__gte=since) if bucket == "sent" else qs.filter(decided_at__gte=since)
    return qs


def filter_orders(qs, params):
    """GET: ?period=week&bucket=rejected (bosh panel kartasi)."""
    if params.get("bucket") in BUCKETS:
        since = period_starts()[params["period"]] if params.get("period") in PERIOD_KEYS else None
        qs = apply_order_bucket(qs, params["bucket"], since)
    return qs


def department_dashboard(qs):
    return {
        "orders": {
            "submitted": qs.filter(status=S.SUBMITTED).count(),
            "rejected": qs.filter(status=S.REJECTED).count(),
            "approved": qs.filter(status__in=APPROVED).count(),
        },
        "periods": period_cards(lambda since: {b: apply_order_bucket(qs, b, since).count() for b in BUCKETS}),
    }
