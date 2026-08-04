"""Vazifa ro'yxati filtrlari va bosh panel hisob-kitobi — BITTA joyda.

Bosh paneldagi karta soni va karta bosilganda chiqadigan jadval bir xil `apply_bucket` dan
foydalanadi, shuning uchun raqam va ro'yxat hech qachon farq qilmaydi.
"""
import calendar
from datetime import datetime, time, timedelta

from django.db.models import F, Q
from django.utils import timezone
from django.utils.dateparse import parse_date

from .models import Task

S = Task.Status
ACTIVE = [S.CONTROL, S.IN_PROGRESS, S.IN_REVIEW]

BUCKETS = {
    # kalit: (sarlavha, tavsif)
    "active": "Faol (bajarilmagan)",
    "overdue": "Muddati o'tgan",
    "done": "Bajarilgan",
    "late": "Kechikib bajarilgan",
    "review": "Tekshiruv kutilmoqda",
}


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


def apply_bucket(qs, bucket, since=None):
    """Toifa bo'yicha filtr. `since` bo'lsa: bajarilganlar — shu sanadan keyin bajarilgan,
    qolganlar — shu sanadan keyin yaratilgan."""
    now = timezone.now()
    if bucket == "active":
        qs = qs.filter(status__in=ACTIVE)
    elif bucket == "overdue":
        qs = qs.filter(status__in=ACTIVE, due_at__lt=now)
    elif bucket == "done":
        qs = qs.filter(status=S.DONE)
    elif bucket == "late":
        qs = qs.filter(status=S.DONE, completed_at__gt=F("due_at"))
    elif bucket == "review":
        qs = qs.filter(status=S.IN_REVIEW)
    if since is not None:
        qs = qs.filter(completed_at__gte=since) if bucket in ("done", "late") else qs.filter(created_at__gte=since)
    return qs


def _day_range(d):
    tz = timezone.get_current_timezone()
    start = timezone.make_aware(datetime.combine(d, time.min), tz)
    return start, start + timedelta(days=1)


def filter_tasks(qs, params, user):
    """GET parametrlari bo'yicha filtr (ro'yxat, jadval, taqvim, doska)."""
    if params.get("mine") == "1":
        qs = qs.filter(assignments__developer=user)
    if params.get("q"):
        q = params["q"].strip()
        qs = qs.filter(Q(title__icontains=q) | Q(description__icontains=q) | Q(project__name__icontains=q))
    if params.get("status"):
        qs = qs.filter(status__in=params["status"].split(","))
    if params.get("priority"):
        qs = qs.filter(priority__in=params["priority"].split(","))
    if params.get("project"):
        qs = qs.filter(project_id=params["project"])
    if params.get("project_name"):
        qs = qs.filter(project__name__icontains=params["project_name"])
    if params.get("assignee"):
        qs = qs.filter(assignments__developer_id=params["assignee"])
    if params.get("assignee_name"):
        name = params["assignee_name"].strip()
        qs = qs.filter(
            Q(assignments__developer__first_name__icontains=name)
            | Q(assignments__developer__last_name__icontains=name)
        )

    since = None
    if params.get("period") in ("year", "month", "week"):
        since = period_starts()[params["period"]]
    if params.get("bucket") in BUCKETS or since is not None:
        qs = apply_bucket(qs, params.get("bucket"), since)

    # Muddat bo'yicha: aniq kun, oraliq, "bugun"/"shu hafta" tezkor filtri, oy yarmi
    today = timezone.localdate()
    due = params.get("due")
    if due == "today":
        start, end = _day_range(today)
        qs = qs.filter(due_at__gte=start, due_at__lt=end)
    elif due == "week":
        monday = today - timedelta(days=today.weekday())
        qs = qs.filter(due_at__gte=_day_range(monday)[0], due_at__lt=_day_range(monday + timedelta(days=7))[0])
    elif due == "month":
        first = today.replace(day=1)
        last = today.replace(day=calendar.monthrange(today.year, today.month)[1])
        qs = qs.filter(due_at__gte=_day_range(first)[0], due_at__lt=_day_range(last)[1])
    if params.get("date") and (d := parse_date(params["date"])):
        start, end = _day_range(d)
        qs = qs.filter(due_at__gte=start, due_at__lt=end)
    if params.get("due_from") and (d := parse_date(params["due_from"])):
        qs = qs.filter(due_at__gte=_day_range(d)[0])
    if params.get("due_to") and (d := parse_date(params["due_to"])):
        qs = qs.filter(due_at__lt=_day_range(d)[1])
    if params.get("half") in ("1", "2"):
        qs = qs.filter(due_at__day__lte=15) if params["half"] == "1" else qs.filter(due_at__day__gt=15)
    return qs.distinct()


def dashboard_counts(qs):
    """Bosh panel kartalari: davrlar bo'yicha (yil/oy/hafta) va umumiy."""
    starts = period_starts()
    labels = {"year": "Yil boshidan", "month": "Oy boshidan", "week": "Hafta boshidan"}
    periods = []
    for key in ("year", "month", "week"):
        periods.append({
            "key": key,
            "label": labels[key],
            "since": timezone.localtime(starts[key]).date(),
            "counts": {b: apply_bucket(qs, b, starts[key]).count() for b in ("active", "overdue", "done")},
        })
    totals = {b: apply_bucket(qs, b).count() for b in ("late", "overdue", "review", "active")}
    return {"periods": periods, "totals": totals, "labels": BUCKETS}
