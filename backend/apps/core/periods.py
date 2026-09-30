"""Bosh panel davrlari (yil / oy / hafta boshidan) — BITTA joyda: vazifalar va buyurtmalar bir xil hisoblanadi."""
from datetime import datetime, time, timedelta

from django.utils import timezone

PERIOD_KEYS = ("year", "month", "week")
PERIOD_LABELS = {"year": "Yil boshidan", "month": "Oy boshidan", "week": "Hafta boshidan"}


def period_starts(now=None):
    """Mahalliy vaqt bo'yicha yil, oy va hafta (dushanba) boshlanishi."""
    today = timezone.localdate(now)
    tz = timezone.get_current_timezone()

    def at(d):
        return timezone.make_aware(datetime.combine(d, time.min), tz)

    return {
        "year": at(today.replace(month=1, day=1)),
        "month": at(today.replace(day=1)),
        "week": at(today - timedelta(days=today.weekday())),
    }


def period_cards(count):
    """Bosh panel kartalari: [{key, label, since, counts}]. `count(since)` — shu davr uchun {toifa: son}."""
    starts = period_starts()
    return [
        {"key": key, "label": PERIOD_LABELS[key], "since": timezone.localtime(starts[key]).date(), "counts": count(starts[key])}
        for key in PERIOD_KEYS
    ]
