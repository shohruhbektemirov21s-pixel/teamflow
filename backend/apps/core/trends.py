"""Ro'yxat sahifalari tepasidagi ko'rsatkich kartalari: jami son va so'nggi haftalar bo'yicha kichik grafik (sparkline).

Bitta so'rov: har bir ko'rsatkich uchun jami son va har hafta uchun `Count(filter=...)` — sahifa ochilganda bazaga
bitta `aggregate` ketadi. Hafta — dushanbadan boshlanadi (`core/periods.py` bilan bir xil qoida).
"""
from datetime import datetime, time, timedelta

from django.db.models import Count, Q
from django.utils import timezone

WEEKS = 8


def week_starts(weeks=WEEKS):
    """Eng eskisidan boshlab, oxirgisi — shu hafta."""
    today = timezone.localdate()
    monday = today - timedelta(days=today.weekday())
    tz = timezone.get_current_timezone()
    return [timezone.make_aware(datetime.combine(monday - timedelta(weeks=i), time.min), tz) for i in range(weeks - 1, -1, -1)]


def stats_block(qs, metrics, tabs=None):
    """`metrics`: {kalit: (shart Q, sana maydoni)} — har biri uchun jami son va haftalik qator.
    `tabs`: {kalit: shart Q} — holat tugmalaridagi sonlar (grafiksiz).

    Qaytaradi: {"totals": {kalit: son}, "series": {kalit: [8 ta son]}, "tabs": {kalit: son}}.
    """
    starts = week_starts()
    ends = [*starts[1:], starts[-1] + timedelta(weeks=1)]
    aggregates = {}
    for key, (condition, field) in metrics.items():
        aggregates[f"t_{key}"] = Count("pk", filter=condition, distinct=True)
        for i, (start, end) in enumerate(zip(starts, ends)):
            aggregates[f"w{i}_{key}"] = Count("pk", filter=condition & Q(**{f"{field}__gte": start, f"{field}__lt": end}), distinct=True)
    for key, condition in (tabs or {}).items():
        aggregates[f"tab_{key}"] = Count("pk", filter=condition, distinct=True)
    counts = qs.aggregate(**aggregates)
    return {
        "totals": {key: counts[f"t_{key}"] for key in metrics},
        "series": {key: [counts[f"w{i}_{key}"] for i in range(len(starts))] for key in metrics},
        "tabs": {key: counts[f"tab_{key}"] for key in (tabs or {})},
    }
