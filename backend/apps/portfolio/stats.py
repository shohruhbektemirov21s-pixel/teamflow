"""Portfolio ko'rsatkichlari: reyting, sharhlar, kuzatuvchilar, loyihalar, tajriba.

Hisoblanadi, saqlanmaydi (holatdan kelib chiqadigan qiymatni saqlash — nomuvofiqlik manbai).
Sonlar subquery bilan olinadi: bir nechta JOIN bir-birini ko'paytirib, o'rtacha bahoni buzmasin.
"""
from datetime import timedelta

from django.core.cache import cache
from django.db import transaction
from django.db.models import Avg, BooleanField, Count, Exists, F, IntegerField, OuterRef, Q, Subquery, Value
from django.db.models.functions import Coalesce, ExtractYear
from django.utils import timezone

from apps.projects.models import Project, ProjectMember
from apps.tasks.models import Task, TaskAssignment

from .models import Follow, PortfolioItem, PortfolioReview
from .permissions import portfolio_owners


DEVELOPER_RANKING_CACHE_KEY = "portfolio:developer-ranking:default"
SUMMARY_CACHE_KEY = "portfolio:summary"


def invalidate_developer_ranking():
    """Tranzaksiya tasdiqlangach o'chiriladi: undan oldin o'chirilsa, parallel so'rov keshni eski
    (hali commit bo'lmagan) ma'lumot bilan qayta to'ldirib, 60 soniya noto'g'ri reyting ko'rsatardi."""
    transaction.on_commit(lambda: cache.delete_many([DEVELOPER_RANKING_CACHE_KEY, SUMMARY_CACHE_KEY]))


def summary():
    """Dasturchilar sahifasi tepasidagi umumiy ko'rsatkichlar va mutaxassislik filtri chiplari."""
    owners = portfolio_owners()
    reviews = PortfolioReview.objects.filter(item__owner__in=owners)
    totals = reviews.aggregate(avg=Avg("stars"), rated=Count("item", distinct=True))
    specialties = (owners.exclude(specialty=None).values("specialty_id", "specialty__name")
                   .annotate(n=Count("pk")).order_by("specialty__name"))
    developers = owners.count()
    joined = owners.filter(date_joined__gte=timezone.now() - timedelta(days=30)).count()
    before = developers - joined
    active_projects = (Project.objects.exclude(stage=Project.Stage.DONE)
                       .filter(memberships__developer__in=owners).distinct().count())
    return {
        "developers": developers,
        "developers_growth": round(joined / before * 100) if joined and before else None,
        "average_rating": round(totals["avg"], 1) if totals["avg"] is not None else None,
        "rated_projects": totals["rated"],
        "active_projects": active_projects,
        "specialties": [{"id": row["specialty_id"], "name": row["specialty__name"], "count": row["n"]} for row in specialties],
    }


def following_count(viewer):
    return Follow.objects.filter(follower=viewer, developer__in=portfolio_owners()).count()


def developer_highlights(users):
    """Ro'yxat kartalari uchun: oxirgi 3 ta loyiha nomi, qolganlari soni va tajriba (bitta so'rov)."""
    users = list(users)
    items = {}
    for item in (PortfolioItem.objects.filter(owner__in=users).select_related("project")
                 .order_by("-created_at", "-id")):
        items.setdefault(item.owner_id, []).append(item)
    result = {}
    for user in users:
        mine = items.get(user.pk, [])
        result[user.pk] = {
            "projects": [i.display_title for i in mine[:3]],
            "projects_extra": max(len(mine) - 3, 0),
            "experience_months": experience(user, mine)["months"],
        }
    return result


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
        is_following=(
            Exists(Follow.objects.filter(follower=viewer.pk, developer=OuterRef("pk")))
            if viewer is not None else Value(False, output_field=BooleanField())
        ),
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


def item_status(item):
    """Loyiha holati: "done" · "active" · "planned" yoki None (sanasi ham, loyihasi ham yo'q).
    TeamFlow loyihasida — bosqichidan, o'zi qo'shganda — sanalaridan."""
    if item.project_id:
        stage = item.project.stage
        return "done" if stage == Project.Stage.DONE else "planned" if stage == Project.Stage.PLANNED else "active"
    start, end = item.period
    today = timezone.localdate()
    if end and end <= today:
        return "done"
    if start and start > today:
        return "planned"
    return "active" if start or end else None


WORK_LIMIT = 20  # loyiha oynasida ko'rsatiladigan bajarilgan ishlar soni


def item_work(item):
    """TeamFlow loyihasi uchun: mas'ul, umumiy jarayon, egasi bajargan ishlar va jamoa (o'zi qo'shgan loyihada — None)."""
    if not item.project_id:
        return None
    project = item.project
    totals = (Task.objects.filter(project=project, archived_at__isnull=True)
              .aggregate(total=Count("pk"), done=Count("pk", filter=Q(status=Task.Status.DONE))))
    completed = (done_assignments().filter(developer=item.owner, task__project=project).select_related("task")
                 .order_by(F("task__completed_at").desc(nulls_last=True), "-task_id")[:WORK_LIMIT])
    team = (ProjectMember.objects.filter(project=project, developer__is_active=True).select_related("developer")
            .order_by("developer__first_name", "developer__last_name", "pk"))
    return {"lead": project.created_by, "total": totals["total"], "done": totals["done"],
            "completed": [a.task for a in completed], "team": [m.developer for m in team]}


def developer_technologies(items, limit=12):
    """Dasturchi texnologiyalari = loyihalaridagilar yig'indisi (ko'p uchraganlari avval)."""
    counts, names = {}, {}
    for item in items:
        for name in item.technologies:
            key = name.lower()
            names.setdefault(key, name)
            counts[key] = counts.get(key, 0) + 1
    ordered = sorted(counts, key=lambda k: (-counts[k], k))
    return [{"name": names[k], "projects": counts[k]} for k in ordered[:limit]]


def recent_tasks(owner, limit=10):
    rows = (done_assignments().filter(developer=owner).select_related("task__project")
            .order_by(F("task__completed_at").desc(nulls_last=True), "-task_id")[:limit])
    return [{"id": a.task_id, "code": a.task.code, "title": a.task.title, "project": a.task.project.name,
             "completed_at": a.task.completed_at} for a in rows]


def round_rating(value):
    return round(float(value), 1) if value is not None else None
