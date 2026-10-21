"""Dasturchining hozirgi holati va mas'ul loyihalari — oddiy foydalanuvchi ham ko'radi."""
from datetime import timedelta

from django.core.cache import cache
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from apps.accounts.models import Role
from apps.panel.tests.factories import client_for, make_user, today
from apps.projects.models import Project, ProjectMember
from apps.tasks.models import Task, TaskAssignment

from .test_api import PortfolioTestCase


class StatusTests(PortfolioTestCase):
    def setUp(self):
        super().setUp()
        self.user = make_user(Role.USER)

    def task(self, developer=None, project=None, **kw):
        kw.setdefault("status", Task.Status.IN_PROGRESS)
        task = Task.objects.create(project=project or self.project, title=kw.pop("title", "Vazifa"),
                                   created_by=self.pm, **kw)
        TaskAssignment.objects.create(task=task, developer=developer or self.dev)
        return task

    def status_of(self, developer=None):
        developer = developer or self.dev
        res = client_for(self.user).get(f"/api/portfolio/{developer.pk}/")
        self.assertEqual(res.status_code, 200)
        return res.data["status"]

    def test_free_without_active_tasks(self):
        self.assertEqual(self.status_of(), {"state": "free", "active_tasks": 0, "trip_return_date": None})

    def test_busy_counts_only_active_unarchived_tasks(self):
        self.task()
        self.task(status=Task.Status.IN_REVIEW)
        self.task(status=Task.Status.DONE, completed_at=timezone.now())
        self.task(archived_at=timezone.now())
        self.task(developer=self.other)
        status = self.status_of()
        self.assertEqual(status["state"], "busy")
        self.assertEqual(status["active_tasks"], 2)

    def test_business_trip_wins_over_busy_and_ended_trip_is_ignored(self):
        self.task()
        self.dev.business_trip_return_date = today() + timedelta(days=3)
        self.dev.save()
        status = self.status_of()
        self.assertEqual(status["state"], "trip")
        self.assertEqual(status["trip_return_date"], today() + timedelta(days=3))
        self.dev.business_trip_return_date = today() - timedelta(days=1)
        self.dev.save()
        status = self.status_of()
        self.assertEqual(status["state"], "busy")
        self.assertIsNone(status["trip_return_date"])

    def test_list_row_has_status(self):
        self.task()
        res = client_for(self.user).get("/api/portfolio/")
        rows = {r["id"]: r for r in res.data["results"]}
        self.assertEqual(rows[self.dev.pk]["status"]["state"], "busy")
        self.assertEqual(rows[self.dev.pk]["status"]["active_tasks"], 1)
        self.assertEqual(rows[self.other.pk]["status"]["state"], "free")

    def test_ordinary_user_sees_current_projects_without_finished_or_foreign_ones(self):
        self.task()
        done = Project.objects.create(code="PRJ-2", name="Eski loyiha", start_date=today() - timedelta(days=90),
                                      end_date=today() - timedelta(days=10), created_by=self.pm,
                                      stage=Project.Stage.DONE)
        foreign = Project.objects.create(code="PRJ-3", name="Boshqaning loyihasi", start_date=today(),
                                         end_date=today() + timedelta(days=30), created_by=self.pm)
        ProjectMember.objects.create(project=done, developer=self.dev)
        ProjectMember.objects.create(project=foreign, developer=self.other)
        res = client_for(self.user).get(f"/api/portfolio/{self.dev.pk}/")
        self.assertEqual(res.data["current_projects"],
                         [{"code": "PRJ-1", "name": "Portal", "stage": self.project.stage, "active_tasks": 1}])

    def test_status_does_not_add_queries_per_developer(self):
        def count():
            cache.clear()
            with CaptureQueriesContext(connection) as ctx:
                client_for(self.user).get("/api/portfolio/")
            return len(ctx)

        baseline = count()
        for _ in range(4):
            self.task(developer=make_user(Role.DEVELOPER))
        self.assertEqual(count(), baseline)
