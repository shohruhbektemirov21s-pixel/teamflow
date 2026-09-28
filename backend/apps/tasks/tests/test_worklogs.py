from datetime import date

from django.test import TestCase

from apps.accounts.models import Role
from apps.panel.tests.factories import client_for, make_user
from apps.projects.models import Project, ProjectMember
from apps.tasks.models import Task, TaskAssignment


class WorkLogTests(TestCase):
    def setUp(self):
        self.pm = make_user(Role.PM)
        self.dev = make_user(Role.DEVELOPER)
        self.other = make_user(Role.DEVELOPER)
        project = Project.objects.create(name="Portal", start_date=date.today(), end_date=date.today(), created_by=self.pm)
        for user in (self.dev, self.other):
            ProjectMember.objects.create(project=project, developer=user)
        self.task = Task.objects.create(project=project, title="API", created_by=self.pm)
        TaskAssignment.objects.create(task=self.task, developer=self.dev)
        self.url = f"/api/tasks/{self.task.pk}/worklogs/"
        self.payload = {"hours": "1.50", "note": "API validation completed", "work_date": date.today().isoformat()}

    def test_assignee_logs_work_and_detail_contains_total(self):
        response = client_for(self.dev).post(self.url, self.payload, format="json")
        self.assertEqual(response.status_code, 201)
        detail = client_for(self.pm).get(f"/api/tasks/{self.task.pk}/").data
        self.assertEqual(detail["worklog_hours"], "1.50")
        self.assertEqual(detail["worklogs"][0]["note"], self.payload["note"])
        self.assertEqual(detail["worklogs"][0]["author"]["id"], self.dev.pk)

    def test_outsider_cannot_log_or_read(self):
        self.assertEqual(client_for(self.other).post(self.url, self.payload, format="json").status_code, 404)

    def test_invalid_hours_note_date(self):
        for patch in ({"hours": 0}, {"hours": 25}, {"hours": -1}, {"note": " "}, {"work_date": "2999-01-01"}):
            with self.subTest(patch=patch):
                response = client_for(self.dev).post(self.url, {**self.payload, **patch}, format="json")
                self.assertEqual(response.status_code, 400)

    def test_other_assignee_cannot_delete_but_author_can(self):
        TaskAssignment.objects.create(task=self.task, developer=self.other)
        response = client_for(self.dev).post(self.url, self.payload, format="json")
        self.assertEqual(response.status_code, 201)
        pk = response.data["worklogs"][0]["id"]
        url = f"{self.url}{pk}/"
        self.assertEqual(client_for(self.other).delete(url).status_code, 403)
        self.assertEqual(client_for(self.dev).delete(url).status_code, 200)
        self.assertEqual(client_for(self.pm).get(f"/api/tasks/{self.task.pk}/").data["worklogs"], [])

