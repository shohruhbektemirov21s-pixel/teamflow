from datetime import date

from django.test import TestCase

from apps.accounts.models import Role
from apps.panel.tests.factories import client_for, make_user
from apps.projects.models import Project, ProjectMember
from apps.tasks.models import Task


class BulkTaskTests(TestCase):
    def setUp(self):
        self.pm = make_user(Role.PM)
        self.dev = make_user(Role.DEVELOPER)
        self.other = make_user(Role.DEVELOPER)
        self.project = Project.objects.create(name="Portal", start_date=date.today(), end_date=date.today(), created_by=self.pm)
        for dev in (self.dev, self.other):
            ProjectMember.objects.create(project=self.project, developer=dev)
        self.client = client_for(self.pm)

    def post(self, **data):
        return self.client.post("/api/tasks/bulk/", {"project": self.project.pk, **data}, format="json")

    def test_distribute_rows_with_individual_assignees(self):
        response = self.post(tasks=[
            {"title": "API", "assignee_ids": [self.dev.pk], "priority": "high"},
            {"title": "UI", "assignee_ids": [self.other.pk], "due_at": "2026-10-10T10:00:00Z"},
        ])
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["created"], 2)
        self.assertEqual(list(Task.objects.get(title="API").assignees.all()), [self.dev])
        self.assertEqual(list(Task.objects.get(title="UI").assignees.all()), [self.other])

    def test_invalid_second_assignee_rolls_back_entire_batch(self):
        outsider = make_user(Role.DEVELOPER)
        response = self.post(tasks=[
            {"title": "Valid", "assignee_ids": [self.dev.pk]},
            {"title": "Invalid", "assignee_ids": [outsider.pk]},
        ])
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Task.objects.count(), 0)

    def test_legacy_list_is_validated_before_writes(self):
        response = self.post(titles=["Valid", None], assignee_ids=[self.dev.pk])
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Task.objects.count(), 0)

    def test_legacy_list_still_works(self):
        response = self.post(titles=["One", "Two"], assignee_ids=[self.dev.pk])
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["created"], 2)

    def test_invalid_priority_dates_and_batch_size(self):
        for data in (
            {"titles": ["One"], "priority": "unknown"},
            {"titles": ["One"], "due_at": "not-a-date"},
            {"titles": ["One"] * 101},
            {"titles": "not a list"},
            {"tasks": [{"title": "One", "starts_at": "2026-10-12T00:00Z", "due_at": "2026-10-10T00:00Z", "assignee_ids": [self.dev.pk]}]},
        ):
            with self.subTest(data=data):
                response = self.post(assignee_ids=[self.dev.pk], **data)
                self.assertEqual(response.status_code, 400)
                self.assertFalse(Task.objects.exists())

    def test_developer_tasks_remain_self_assigned(self):
        self.client = client_for(self.dev)
        response = self.post(tasks=[{"title": "Mine", "assignee_ids": [self.other.pk]}])
        self.assertEqual(response.status_code, 201)
        self.assertEqual(list(Task.objects.get().assignees.all()), [self.dev])

    def test_invisible_project_denied(self):
        outsider = make_user(Role.DEVELOPER)
        self.client = client_for(outsider)
        self.assertEqual(self.post(titles=["No"], assignee_ids=[outsider.pk]).status_code, 404)

