"""Portfolio ko'rsatkichlari: reyting, sharhlar, kuzatuvchilar, loyihalar, tajriba.

Hisoblanadi, saqlanmaydi (holatdan kelib chiqadigan qiymatni saqlash — nomuvofiqlik manbai).
Sonlar subquery bilan olinadi: bir nechta JOIN bir-birini ko'paytirib, o'rtacha bahoni buzmasin.
"""
from datetime import timedelta

from django.db.models import Avg, Count, Exists, F, IntegerField, OuterRef, Subquery, Value
from django.db.models.functions import Coalesce, ExtractMonth, ExtractYear
from django.utils import timezone

from apps.projects.models import ProjectMember
from apps.tasks.models import Task, TaskAssignment

from .models import Follow, PortfolioItem, PortfolioReview
from .permissions import portfolio_owners


def _count(qs, group):
    return Coalesce(Subquery(qs.values(group).annotate(n=Count("pk")).values("n")[:1], output_field=IntegerField()),
                    Value(0))


def done_assignments():
    return TaskAssignment.objects.filter(task__status=Task.Status.DONE, task__archived_at__isnull=True)


def developers_with_stats(viewer):
    """Dasturchilar reyting ko'rsatkichlari bilan. Tartib: reyting ↓ (bahosizlar oxirida), sharhlar ↓, kuzatuvchilar ↓."""
    reviews = PortfolioReview.objects.filter(item__owner=OuterRef("pk"))
    items = PortfolioItem.objects.filter(owner=OuterRef("pk"))
    # Portfolio hali ochilmagan (yozuvi yaratilmagan) TeamFlow loyihalari ham sanaladi.
    unsynced = ProjectMember.objects.filter(developer=OuterRef("pk")).exclude(
        Exists(PortfolioItem.objects.filter(owner=OuterRef("developer"), project=OuterRef("project"))))
    return portfolio_owners().select_related("specialty").annotate(
        rating=Subquery(reviews.values("item__owner").annotate(a=Avg("stars")).values("a")[:1]),
        reviews_count=_count(reviews, "item__owner"),
        followers_count=_count(Follow.objects.filter(developer=OuterRef("pk")), "developer"),
        projects_count=_count(items, "owner") + _count(unsynced, "developer"),
        tasks_done=_count(done_assignments().filter(developer=OuterRef("pk")), "developer"),
        is_following=Exists(Follow.objects.filter(follower=viewer.pk, developer=OuterRef("pk"))),
    ).order_by(F("rating").desc(nulls_last=True), "-reviews_count", "-followers_count",
               "first_name", "last_name", "pk")


def items_with_stats(owner=None):
    reviews = PortfolioReview.objects.filter(item=OuterRef("pk"))
    qs = PortfolioItem.objects.all() if owner is None else PortfolioItem.objects.filter(owner=owner)
    return qs.select_related("project").annotate(
        rating=Subquery(reviews.values("item").annotate(a=Avg("stars")).values("a")[:1]),
        reviews_count=_count(reviews, "item"),
        videos_count=Count("videos", distinct=True),
    )


def tasks_done_by_project(owner, project_ids):
    rows = (done_assignments().filter(developer=owner, task__project_id__in=project_ids)
            .values("task__project_id").annotate(n=Count("pk")))
    return {row["task__project_id"]: row["n"] for row in rows}


def _months_between(start, end):
    months = (end.year - start.year) * 12 + end.month - start.month - (end.day < start.day)
    return max(months, 0)


def experience(owner, items):
    """Tajriba: TeamFlow'ga qo'shilgan kun yoki eng erta loyiha boshlanishidan bugungacha."""
    today = timezone.localdate()
    starts = [timezone.localtime(owner.date_joined).date()] + [s for s, _ in (i.period for i in items) if s]
    since = min(starts)
    return {"since": since, "months": _months_between(since, today)}


def years(owner, items):
    """Yillar bo'yicha: shu yilda davom etgan loyihalar va bajarilgan vazifalar soni (yangi yil tepada)."""
    today = timezone.localdate()
    projects = {}
    for item in items:
        start, end = item.period
        start = start or timezone.localtime(item.created_at).date()
        end = max(min(end or today, today), start)
        for year in range(start.year, end.year + 1):
            projects[year] = projects.get(year, 0) + 1
    tasks = {row["y"]: row["n"] for row in done_assignments().filter(developer=owner, task__completed_at__isnull=False)
             .annotate(y=ExtractYear("task__completed_at")).values("y").annotate(n=Count("pk"))}
    return [{"year": y, "projects": projects.get(y, 0), "tasks": tasks.get(y, 0)}
            for y in sorted(set(projects) | set(tasks), reverse=True) if y <= today.year]


def recent_tasks(owner, limit=10):
    rows = (done_assignments().filter(developer=owner).select_related("task__project")
            .order_by(F("task__completed_at").desc(nulls_last=True), "-task_id")[:limit])
    return [{"id": a.task_id, "code": a.task.code, "title": a.task.title, "project": a.task.project.name,
             "completed_at": a.task.completed_at} for a in rows]


def tasks_late(owner):
    """Kechikib bajarilgan vazifalar soni — `tasks.filters.bucket_condition("late")` bilan bir xil qoida."""
    return done_assignments().filter(developer=owner, task__completed_at__gt=F("task__due_at")).count()


def months(owner, limit=12):
    """So'nggi oylar bo'yicha bajarilgan vazifalar soni (joriy oy tepada)."""
    rows = (done_assignments().filter(developer=owner, task__completed_at__isnull=False)
            .annotate(y=ExtractYear("task__completed_at"), m=ExtractMonth("task__completed_at"))
            .values("y", "m").annotate(n=Count("pk")))
    counts = {(r["y"], r["m"]): r["n"] for r in rows}
    today = timezone.localdate()
    result = []
    y, m = today.year, today.month
    for _ in range(limit):
        result.append({"year": y, "month": m, "tasks": counts.get((y, m), 0)})
        m -= 1
        if m == 0:
            m, y = 12, y - 1
    return result


def weeks(owner, limit=8):
    """So'nggi haftalar bo'yicha bajarilgan vazifalar soni (dushanbadan boshlab, joriy hafta tepada)."""
    today = timezone.localdate()
    since = today - timedelta(weeks=limit - 1, days=today.weekday())
    rows = done_assignments().filter(developer=owner, task__completed_at__date__gte=since).values_list(
        "task__completed_at", flat=True)
    counts = {}
    for completed_at in rows:
        d = timezone.localtime(completed_at).date()
        week_start = d - timedelta(days=d.weekday())
        counts[week_start] = counts.get(week_start, 0) + 1
    result = []
    cur = today - timedelta(days=today.weekday())
    for _ in range(limit):
        result.append({"week_start": cur, "tasks": counts.get(cur, 0)})
        cur -= timedelta(weeks=1)
    return result


def summary():
    """Portfolio sahifasi tepasidagi 3 ta statistika kartasi — barcha dasturchilar bo'yicha."""
    owners = portfolio_owners()
    avg_rating = PortfolioReview.objects.filter(item__owner__in=owners).aggregate(a=Avg("stars"))["a"]
    rated_items = PortfolioItem.objects.filter(owner__in=owners, reviews__isnull=False).distinct().count()
    return {
        "developers_count": owners.count(),
        "avg_rating": round_rating(avg_rating),
        "rated_items_count": rated_items,
    }


def round_rating(value):
    return round(float(value), 1) if value is not None else None
