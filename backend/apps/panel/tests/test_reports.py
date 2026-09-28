from datetime import date, timedelta

from django.test import TestCase
from django.utils import timezone

from apps.accounts.models import Role
from apps.core.services import log
from apps.projects.models import Project, ProjectMember
from apps.tasks.models import Submission, Task, TaskAssignment
from .factories import client_for, make_user


class ReportTests(TestCase):
    def setUp(self):
        self.pm = make_user(Role.PM)
        self.dev = make_user(Role.DEVELOPER)
        self.other = make_user(Role.DEVELOPER)
        self.client = client_for(self.pm)
        self.project = Project.objects.create(name="Portal", start_date=date.today(), end_date=date.today(), created_by=self.pm)
        self.second = Project.objects.create(name="Mobile", start_date=date.today(), end_date=date.today(), created_by=self.pm)
        ProjectMember.objects.create(project=self.project, developer=self.dev)
        self.task = self.make_task(self.project, "Portal ready", self.dev)
        self.hidden = self.make_task(self.project, "Private task", self.other)
        self.other_task = self.make_task(self.second, "Mobile ready", self.other)
        for task in (self.task, self.hidden, self.other_task):
            Submission.objects.create(task=task, submitted_by=self.dev, note="Result", decision="accepted", reviewed_by=self.pm, reviewed_at=timezone.now())
            log(self.pm, "task_accepted", task.title, task)
        log(self.pm, "project_updated", "Portal dates changed", self.project)

    def make_task(self, project, title, dev):
        task = Task.objects.create(project=project, title=title, created_by=self.pm, status="done", completed_at=timezone.now())
        TaskAssignment.objects.create(task=task, developer=dev)
        return task

    def test_pm_report_contract_and_project_filter(self):
        response = self.client.get("/api/workdone/", {"project": self.project.pk})
        self.assertEqual(response.status_code, 200)
        self.assertEqual({t["id"] for t in response.data["completed_tasks"]}, {self.task.pk, self.hidden.pk})
        self.assertEqual({r["task_id"] for r in response.data["reviews"]}, {self.task.pk, self.hidden.pk})
        self.assertNotIn("Mobile ready", [a["message"] for a in response.data["recent_activity"]])
        self.assertIn("decision_label", response.data["reviews"][0])
        self.assertIn("target", response.data["recent_activity"][0])

    def test_report_search_and_period(self):
        Task.objects.filter(pk=self.task.pk).update(completed_at=timezone.now() - timedelta(days=10))
        response = self.client.get("/api/workdone/", {"q": "Portal ready", "days": 7})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["completed_tasks"], [])
        self.assertEqual(len(response.data["reviews"]), 1)

    def test_report_pagination(self):
        for n in range(25):
            self.make_task(self.project, f"Work {n}", self.dev)
        response = self.client.get("/api/workdone/", {"page": 2})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["counts"]["tasks"], 28)
        self.assertEqual(len(response.data["completed_tasks"]), 8)

    def test_report_rejects_invalid_filters(self):
        for params in ({"days": "abc"}, {"days": 0}, {"days": 99999999}, {"project": "abc"}, {"page": 0}):
            with self.subTest(params=params):
                self.assertEqual(self.client.get("/api/workdone/", params).status_code, 400)

    def test_developer_cannot_read_management_report(self):
        self.assertEqual(client_for(self.dev).get("/api/workdone/").status_code, 403)

    def test_project_history_contains_real_events(self):
        response = self.client.get("/api/history/", {"project": self.project.pk, "paginated": 1})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 3)
        self.assertIn("Portal dates changed", [a["message"] for a in response.data["results"]])

    def test_project_history_respects_task_visibility(self):
        response = client_for(self.dev).get("/api/history/", {"project": self.project.pk, "paginated": 1})
        self.assertEqual(response.status_code, 200)
        messages = [a["message"] for a in response.data["results"]]
        self.assertIn("Portal ready", messages)
        self.assertNotIn("Private task", messages)
        self.assertEqual(client_for(self.dev).get("/api/history/", {"project": self.second.pk}).status_code, 404)

    def test_history_without_project_keeps_personal_scope(self):
        response = client_for(self.dev).get("/api/history/")
        self.assertEqual(response.data, [])

