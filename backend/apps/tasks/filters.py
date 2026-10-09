"""Vazifa ro'yxati filtrlari va bosh panel hisob-kitobi — BITTA joyda.

Bosh paneldagi karta soni va karta bosilganda chiqadigan jadval bir xil `apply_bucket` dan
foydalanadi, shuning uchun raqam va ro'yxat hech qachon farq qilmaydi.
"""
import calendar
from datetime import datetime, time, timedelta

from django.db.models import Count, F, Q
from django.utils import timezone
from django.utils.dateparse import parse_date

from apps.core.codes import resolve_code
from apps.core.periods import PERIOD_KEYS, period_cards, period_starts

from .models import Task, TaskAssignment

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


def bucket_condition(bucket, since=None):
    """Toifa bo'yicha filtr. `since` bo'lsa: bajarilganlar — shu sanadan keyin bajarilgan,
    qolganlar — shu sanadan keyin yaratilgan."""
    condition = Q()
    if bucket == "active":
        condition &= Q(status__in=ACTIVE)
    elif bucket == "overdue":
        condition &= Q(status__in=ACTIVE, due_at__lt=timezone.now())
    elif bucket == "done":
        condition &= Q(status=S.DONE)
    elif bucket == "late":
        condition &= Q(status=S.DONE, completed_at__gt=F("due_at"))
    elif bucket == "review":
        condition &= Q(status=S.IN_REVIEW)
    if since is not None:
        condition &= Q(completed_at__gte=since) if bucket in ("done", "late") else Q(created_at__gte=since)
    return condition


def apply_bucket(qs, bucket, since=None):
    return qs.filter(bucket_condition(bucket, since))


def _day_range(d):
    tz = timezone.get_current_timezone()
    start = timezone.make_aware(datetime.combine(d, time.min), tz)
    return start, start + timedelta(days=1)


def due_range(params):
    """`due_from` / `due_to` (yyyy-mm-dd) — noto'g'ri sana e'tiborga olinmaydi."""
    return parse_date(params.get("due_from") or ""), parse_date(params.get("due_to") or "")


def due_range_condition(due_from, due_to, prefix=""):
    """Muddat oralig'i (ikkala kun ham kiradi) — Vazifalar va Xodimlar filtri uchun BITTA qoida."""
    condition = Q()
    if due_from:
        condition &= Q(**{f"{prefix}due_at__gte": _day_range(due_from)[0]})
    if due_to:
        condition &= Q(**{f"{prefix}due_at__lt": _day_range(due_to)[1]})
    return condition


def filter_tasks(qs, params, user):
    """GET parametrlari bo'yicha filtr (ro'yxat, jadval, taqvim, doska)."""
    if params.get("mine") == "1":
        qs = qs.filter(pk__in=TaskAssignment.objects.filter(developer=user).values("task_id"))
    if params.get("q"):
        code = resolve_code(params["q"])
        if code:
            kind, pk = code
            # Vazifa kodi — aynan shu vazifa; loyiha kodi — shu loyihaning vazifalari
            qs = qs.filter(id=pk) if kind == "task" else qs.filter(project_id=pk)
        else:
            q = params["q"].strip()
            qs = qs.filter(
                Q(code__icontains=q)
                | Q(title__icontains=q)
                | Q(description__icontains=q)
                | Q(project__code__icontains=q)
                | Q(project__name__icontains=q)
            )
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
    if params.get("period") in PERIOD_KEYS:
        since = period_starts()[params["period"]]
    if params.get("bucket") in BUCKETS or since is not None:
        qs = apply_bucket(qs, params.get("bucket"), since)

    # Muddat bo'yicha: aniq kun, oraliq, "bugun"/"shu hafta" tezkor filtri
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
    qs = qs.filter(due_range_condition(*due_range(params)))
    # Only the name lookup can match multiple assignments for one task.
    # Avoid a DISTINCT over every wide task row for the ordinary list/count.
    return qs.distinct() if params.get("assignee_name") else qs


def dashboard_counts(qs):
    """Bosh panel kartalari: davrlar bo'yicha (yil/oy/hafta) va umumiy."""
    periods = period_cards(lambda since: {
        b: Count("pk", filter=bucket_condition(b, since), distinct=True) for b in ("active", "overdue", "done")
    })
    total_keys = ("late", "overdue", "review", "active")
    aggregates = {f"total_{b}": Count("pk", filter=bucket_condition(b), distinct=True) for b in total_keys}
    aggregates.update({f"{p['key']}_{b}": count for p in periods for b, count in p["counts"].items()})
    counts = qs.aggregate(**aggregates)
    for p in periods:
        p["counts"] = {b: counts[f"{p['key']}_{b}"] for b in p["counts"]}
    totals = {b: counts[f"total_{b}"] for b in total_keys}
    return {"periods": periods, "totals": totals, "labels": BUCKETS}
