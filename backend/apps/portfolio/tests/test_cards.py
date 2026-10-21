"""Oddiy foydalanuvchi ro'yxati kartalari: "Hozir band", "So'nggi sharh", filtrlar va ko'rsatkichlar grafigi."""
from datetime import timedelta

from django.core.cache import cache
from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.accounts.models import Role
from apps.panel.tests.factories import client_for, make_user, today
from apps.tasks.models import Task, TaskAssignment

from ..models import PortfolioComment, PortfolioReview
from .test_api import PortfolioTestCase


class CardTests(PortfolioTestCase):
    def setUp(self):
        super().setUp()
        self.user = make_user(Role.USER)
        self.client_ = client_for(self.user)

    def row(self, developer=None, **params):
        res = self.client_.get("/api/portfolio/", params)
        self.assertEqual(res.status_code, 200)
        return {r["id"]: r for r in res.data["results"]}.get((developer or self.dev).pk)

    def ids(self, **params):
        res = self.client_.get("/api/portfolio/", params)
        self.assertEqual(res.status_code, 200)
        return {r["id"] for r in res.data["results"]}

    def task(self, developer=None, project=None, **kw):
        kw.setdefault("status", Task.Status.IN_PROGRESS)
        task = Task.objects.create(project=project or self.project, title="Vazifa", created_by=self.pm, **kw)
        TaskAssignment.objects.create(task=task, developer=developer or self.dev)
        return task

    def test_working_on_is_the_project_of_the_latest_active_task(self):
        self.project.description = "Korxona uchun boshqaruv paneli"
        self.project.save()
        self.task()
        self.assertEqual(self.row()["working_on"], {"name": "Portal", "description": "Korxona uchun boshqaruv paneli"})

    def test_working_on_is_empty_when_free_or_on_trip(self):
        self.assertIsNone(self.row()["working_on"])
        self.task()
        self.dev.business_trip_return_date = today() + timedelta(days=2)
        self.dev.save()
        cache.clear()
        self.assertIsNone(self.row()["working_on"])

    def test_latest_comment_shows_newest_text_with_authors_stars(self):
        item = self.manual_item()
        other_item = self.manual_item(title="Ikkinchi")
        PortfolioReview.objects.create(item=item, author=self.user, stars=4)
        PortfolioComment.objects.create(item=item, author=self.user, text="Eski sharh")
        PortfolioComment.objects.create(item=other_item, author=self.dept, text="Yangi sharh")
        comment = self.row()["latest_comment"]
        self.assertEqual((comment["author"], comment["text"], comment["stars"]), (self.dept.full_name, "Yangi sharh", None))
        PortfolioComment.objects.create(item=item, author=self.user, text="Eng yangi")
        cache.clear()
        comment = self.row()["latest_comment"]
        self.assertEqual((comment["text"], comment["stars"]), ("Eng yangi", 4))
        self.assertIsNone(self.row(self.other)["latest_comment"])

    def test_new_comment_refreshes_cached_default_ranking(self):
        item = self.manual_item()
        self.assertIsNone(self.row()["latest_comment"])  # keshni to'ldiradi
        with self.captureOnCommitCallbacks(execute=True):
            res = self.client_.post(f"/api/portfolio/items/{item.pk}/comments/", {"text": "Zo'r ish"}, format="json")
        self.assertEqual(res.status_code, 201)
        self.assertEqual(self.row()["latest_comment"]["text"], "Zo'r ish")

    def test_filter_by_status(self):
        self.task()
        self.other.business_trip_return_date = today() + timedelta(days=5)
        self.other.save()
        free = make_user(Role.DEVELOPER)
        self.assertEqual(self.ids(status="busy"), {self.dev.pk})
        self.assertEqual(self.ids(status="trip"), {self.other.pk})
        self.assertEqual(self.ids(status="free"), {free.pk})

    def test_filter_by_technology_is_exact_and_case_insensitive(self):
        self.manual_item(technologies=["React", "TypeScript"])
        self.manual_item(owner=self.other, title="Boshqa", technologies=["JavaScript"])
        self.assertEqual(self.ids(technology="react"), {self.dev.pk})
        self.assertEqual(self.ids(technology="Java"), set())
        self.assertEqual(self.ids(technology="JavaScript"), {self.other.pk})

    def test_filter_by_min_rating(self):
        PortfolioReview.objects.create(item=self.manual_item(), author=self.user, stars=5)
        PortfolioReview.objects.create(item=self.manual_item(owner=self.other, title="Past"), author=self.user, stars=3)
        self.assertEqual(self.ids(min_rating="4"), {self.dev.pk})
        self.assertEqual(self.ids(min_rating="3"), {self.dev.pk, self.other.pk})
        self.assertEqual(self.ids(min_rating="x"), self.ids())  # noto'g'ri qiymat e'tiborsiz

    def test_search_finds_project_title_and_technology(self):
        self.manual_item(title="RentCar ilovasi", technologies=["Flutter"])
        self.assertEqual(self.ids(q="rentcar"), {self.dev.pk})
        self.assertEqual(self.ids(q="flutt"), {self.dev.pk})
        self.assertEqual(self.ids(q="Portal"), {self.dev.pk})  # TeamFlow loyihasi nomi
        self.assertEqual(self.ids(q="mavjud-emas"), set())

    def test_filters_do_not_duplicate_developers(self):
        self.manual_item(title="Portal bir", technologies=["Vue"])
        self.manual_item(title="Portal ikki", technologies=["Vue"])
        res = self.client_.get("/api/portfolio/", {"q": "portal", "technology": "Vue"})
        self.assertEqual([r["id"] for r in res.data["results"]], [self.dev.pk])

    def test_summary_has_busy_completed_series_and_technologies(self):
        self.task()
        self.manual_item(technologies=["React", "react", "Docker"])
        self.manual_item(title="Ikkinchi", technologies=["React"])
        data = self.client_.get("/api/portfolio/summary/").data
        self.assertEqual(data["busy_developers"], 1)
        self.assertEqual(data["completed_projects"], 0)
        self.assertEqual(data["technologies"], ["React", "Docker"])
        for key in ("developers", "rated_projects", "completed_projects"):
            self.assertEqual(len(data["series"][key]), 8)
        self.assertEqual(data["series"]["developers"][-1], 2)  # bu hafta qo'shilgan ikki dasturchi

    def test_cards_do_not_add_queries_per_developer(self):
        def count():
            cache.clear()
            with CaptureQueriesContext(connection) as ctx:
                self.client_.get("/api/portfolio/")
            return len(ctx)

        baseline = count()
        for _ in range(4):
            developer = make_user(Role.DEVELOPER)
            self.task(developer=developer)
            PortfolioComment.objects.create(item=self.manual_item(owner=developer, title="X"), author=self.user, text="Yaxshi")
        self.assertEqual(count(), baseline + 0)
