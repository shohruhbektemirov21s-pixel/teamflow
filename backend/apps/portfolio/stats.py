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

from apps.accounts.models import User
from apps.core.trends import stats_block
from apps.projects.models import Project, ProjectMember
from apps.tasks.filters import ACTIVE
from apps.tasks.models import Task, TaskAssignment

from .models import Follow, PortfolioComment, PortfolioItem, PortfolioReview
from .permissions import portfolio_owners
from .files import cover_url
from .technologies import MAX_TECHNOLOGIES


DEVELOPER_RANKING_CACHE_KEY = "portfolio:developer-ranking:default"
SUMMARY_CACHE_KEY = "portfolio:summary"


def invalidate_developer_ranking():
    """Tranzaksiya tasdiqlangach o'chiriladi: undan oldin o'chirilsa, parallel so'rov keshni eski
    (hali commit bo'lmagan) ma'lumot bilan qayta to'ldirib, 60 soniya noto'g'ri reyting ko'rsatardi."""
    transaction.on_commit(lambda: cache.delete_many([DEVELOPER_RANKING_CACHE_KEY, SUMMARY_CACHE_KEY]))


STATES = ("free", "busy", "trip")
TECHNOLOGY_FILTER_LIMIT = 30


def _active_assignment(developer_ref):
    return Exists(TaskAssignment.objects.filter(developer=OuterRef(developer_ref), task__status__in=ACTIVE,
                                                task__archived_at__isnull=True))


def filter_by_status(qs, state):
    """Holat filtri — `developer_statuses` bilan bir xil qoida: xizmat safari > faol ish bor > bo'sh."""
    on_trip = Q(business_trip_return_date__gt=timezone.localdate())
    if state == "trip":
        return qs.filter(on_trip)
    if state == "busy":
        return qs.exclude(on_trip).filter(_active_assignment("pk"))
    return qs.exclude(on_trip).exclude(_active_assignment("pk"))


def filter_by_technology(qs, name):
    """Dasturchining biror portfolio loyihasida shu texnologiya bor (katta-kichik harf farqsiz, aniq nom)."""
    return qs.filter(Exists(PortfolioItem.objects.filter(owner=OuterRef("pk"), technologies__icontains=f'"{name}"')))


def filter_by_search(qs, q):
    """Ism, familiya, mutaxassislik, loyiha nomi yoki texnologiya bo'yicha."""
    items = PortfolioItem.objects.filter(owner=OuterRef("pk")).filter(
        Q(title__icontains=q) | Q(project__name__icontains=q) | Q(technologies__icontains=q))
    return qs.filter(Q(first_name__icontains=q) | Q(last_name__icontains=q) | Q(specialty__name__icontains=q) | Exists(items))


def popular_technologies(owners):
    """Filtr uchun: eng ko'p uchraydigan texnologiyalar (katta-kichik harf farqsiz, birinchi yozilishi saqlanadi)."""
    counts, names = {}, {}
    for technologies in PortfolioItem.objects.filter(owner__in=owners).values_list("technologies", flat=True):
        for name in set(t.casefold() for t in technologies):
            counts[name] = counts.get(name, 0) + 1
        for name in technologies:
            names.setdefault(name.casefold(), name)
    ranked = sorted(counts, key=lambda key: (-counts[key], key))[:TECHNOLOGY_FILTER_LIMIT]
    return [names[key] for key in ranked]


def summary():
    """Dasturchilar sahifasi tepasidagi umumiy ko'rsatkichlar (so'nggi haftalar grafigi bilan) va filtr ro'yxatlari."""
    owners = portfolio_owners()
    reviews = PortfolioReview.objects.filter(item__owner__in=owners)
    totals = reviews.aggregate(avg=Avg("stars"), rated=Count("item", distinct=True))
    specialties = (owners.exclude(specialty=None).values("specialty_id", "specialty__name")
                   .annotate(n=Count("pk")).order_by("specialty__name"))
    developers = owners.count()
    joined = owners.filter(date_joined__gte=timezone.now() - timedelta(days=30)).count()
    before = developers - joined
    members = Project.objects.filter(memberships__developer__in=owners)
    active_projects = members.exclude(stage=Project.Stage.DONE).distinct().count()
    busy = filter_by_status(owners, "busy").count()
    developers_trend = stats_block(owners, {"developers": (Q(), "date_joined")})
    rated_trend = stats_block(reviews, {"rated": (Q(), "created_at")})
    done_trend = stats_block(members, {"done": (Q(stage=Project.Stage.DONE), "updated_at")})
    return {
        "developers": developers,
        "developers_growth": round(joined / before * 100) if joined and before else None,
        "average_rating": round(totals["avg"], 1) if totals["avg"] is not None else None,
        "rated_projects": totals["rated"],
        "active_projects": active_projects,
        "completed_projects": done_trend["totals"]["done"],
        "busy_developers": busy,
        "series": {
            "developers": developers_trend["series"]["developers"],
            "rated_projects": rated_trend["series"]["rated"],
            "completed_projects": done_trend["series"]["done"],
        },
        "specialties": [{"id": row["specialty_id"], "name": row["specialty__name"], "count": row["n"]} for row in specialties],
        "technologies": popular_technologies(owners),
    }


def following_count(viewer):
    return Follow.objects.filter(follower=viewer, developer__in=portfolio_owners()).count()


def developer_statuses(users):
    """Dasturchining hozirgi holati — BITTA qoida: xizmat safarida (`trip`), faol ishi bor (`busy`), aks holda `free`.

    Faol ish — Xodimlar sahifasidagi bilan bir xil ta'rif (`tasks.filters.ACTIVE`, arxivlanmagan). Bitta so'rov.
    """
    return statuses_and_work(users)[0]


def statuses_and_work(users):
    """(holatlar, "hozir band" loyiha) — ikkalasi BITTA so'rovdan: faol ishlar bir marta o'qiladi.

    "Hozir band" — dasturchining eng oxirgi biriktirilgan faol ishi bor loyiha (loyihasiz ish o'tkazib yuboriladi);
    faqat holati `busy` bo'lganlar uchun (xizmat safarida bo'lgan band ko'rinmaydi).
    """
    users = list(users)
    rows = (TaskAssignment.objects.filter(developer__in=users, task__status__in=ACTIVE, task__archived_at__isnull=True)
            .select_related("task__project").order_by("-task_id"))
    counts, project_of = {}, {}
    for row in rows:
        counts[row.developer_id] = counts.get(row.developer_id, 0) + 1
        project = row.task.project
        if project is not None:
            project_of.setdefault(row.developer_id, {"name": project.name, "description": project.description[:140]})
    statuses, working_on = {}, {}
    for user in users:
        active = counts.get(user.pk, 0)
        on_trip = user.is_on_business_trip
        state = "trip" if on_trip else "busy" if active else "free"
        statuses[user.pk] = {"state": state, "active_tasks": active,
                             "trip_return_date": user.business_trip_return_date if on_trip else None}
        if state == "busy" and user.pk in project_of:
            working_on[user.pk] = project_of[user.pk]
    return statuses, working_on


def current_projects(owner, limit=20):
    """Dasturchi hozir mas'ul bo'lgan (yakunlanmagan) TeamFlow loyihalari va ulardagi faol ishlari soni."""
    memberships = (ProjectMember.objects.filter(developer=owner).exclude(project__stage=Project.Stage.DONE)
                   .select_related("project").order_by("-added_at", "-id")[:limit])
    memberships = list(memberships)
    active = dict(TaskAssignment.objects.filter(developer=owner, task__status__in=ACTIVE, task__archived_at__isnull=True,
                                                task__project_id__in=[m.project_id for m in memberships])
                  .order_by().values("task__project_id").annotate(n=Count("pk")).values_list("task__project_id", "n"))
    return [{"code": m.project.code, "name": m.project.name, "stage": m.project.stage,
             "active_tasks": active.get(m.project_id, 0)} for m in memberships]


def _latest_comments(users):
    """Kartadagi "So'nggi sharh": dasturchi loyihalariga yozilgan eng yangi sharh va muallifning o'sha loyihaga bahosi (1 ta so'rov)."""
    newest = PortfolioComment.objects.filter(item__owner=OuterRef("pk")).order_by("-created_at", "-id")
    stars = PortfolioReview.objects.filter(item=OuterRef("item"), author=OuterRef("author")).values("stars")[:1]
    rows = (User.objects.filter(pk__in=[u.pk for u in users])
            .annotate(c_text=Subquery(newest.values("text")[:1]), c_at=Subquery(newest.values("created_at")[:1]),
                      c_first=Subquery(newest.values("author__first_name")[:1]), c_last=Subquery(newest.values("author__last_name")[:1]),
                      c_user=Subquery(newest.values("author__username")[:1]),
                      c_stars=Subquery(newest.annotate(s=Subquery(stars)).values("s")[:1]))
            .exclude(c_text=None).values("pk", "c_text", "c_at", "c_first", "c_last", "c_user", "c_stars"))
    return {r["pk"]: {"author": f'{r["c_first"]} {r["c_last"]}'.strip() or r["c_user"], "text": r["c_text"][:200],
                      "created_at": r["c_at"], "stars": r["c_stars"]} for r in rows}


def developer_highlights(users):
    """Ro'yxat kartalari uchun: oxirgi 3 ta loyiha nomi, qolganlari soni, tajriba, hozirgi holat, hozir band loyiha va so'nggi sharh."""
    users = list(users)
    statuses, working_on = statuses_and_work(users)
    latest_comments = _latest_comments(users)
    items = {}
    for item in (PortfolioItem.objects.filter(owner__in=users).select_related("project")
                 .order_by("-created_at", "-id")):
        items.setdefault(item.owner_id, []).append(item)
    result = {}
    for user in users:
        mine = items.get(user.pk, [])
        technologies = []
        technology_keys = set()
        for item in mine:
            for technology in item.technologies:
                key = technology.casefold()
                if key not in technology_keys and len(technologies) < MAX_TECHNOLOGIES:
                    technology_keys.add(key)
                    technologies.append(technology)
        covered = next((item for item in mine if item.cover), None)
        result[user.pk] = {
            "projects": [i.display_title for i in mine[:3]],
            "projects_extra": max(len(mine) - 3, 0),
            "experience_months": experience(user, mine)["months"],
            "status": statuses[user.pk],
            "working_on": working_on.get(user.pk),
            "latest_comment": latest_comments.get(user.pk),
            "technologies": technologies,
            "cover": cover_url(covered) if covered else None,
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


def recent_tasks(owner, limit=10):
    rows = (done_assignments().filter(developer=owner).select_related("task__project")
            .order_by(F("task__completed_at").desc(nulls_last=True), "-task_id")[:limit])
    return [{"id": a.task_id, "code": a.task.code, "title": a.task.title,
             "project": a.task.project.name if a.task.project_id else "",
             "completed_at": a.task.completed_at} for a in rows]


def round_rating(value):
    return round(float(value), 1) if value is not None else None
