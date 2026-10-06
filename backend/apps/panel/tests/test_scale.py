from django.test import TestCase, override_settings
from django.utils import timezone

from apps.accounts.models import Role
from apps.panel.tests.factories import client_for, make_project, make_task, make_user
from apps.tasks.models import SubTask


class BoundedListsTests(TestCase):
    def setUp(self):
        self.pm = make_user(Role.PM)
        self.dev = make_user(Role.DEVELOPER)
        self.other = make_user(Role.DEVELOPER)
        self.project = make_project(self.pm, self.dev, self.other)
        self.client = client_for(self.pm)

    def test_people_paging_has_no_duplicates_and_pm_cannot_include_boss(self):
        make_user(Role.BOSS)
        first = self.client.get("/api/people/?paginated=1&page_size=1")
        second = self.client.get("/api/people/?paginated=1&page_size=1&page=2")
        self.assertEqual(first.data["count"], 2)
        self.assertTrue(first.data["next"])
        self.assertNotEqual(first.data["results"][0]["id"], second.data["results"][0]["id"])

    def test_project_lookup_is_compact_and_keeps_role_visibility(self):
        other_project = make_project(self.pm, self.other, name="Other project")
        response = client_for(self.dev).get("/api/projects/lookup/?page_size=100")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(set(response.data["results"][0]), {"id", "name", "code"})
        self.assertEqual(response.data["results"][0]["id"], self.project.pk)
        self.assertEqual(self.client.get("/api/projects/lookup/").data["count"], 2)

    def test_searching_work_keeps_all_workload_counts(self):
        make_task(self.project, self.pm, self.dev, title="Unique search phrase")
        for _ in range(4):
            make_task(self.project, self.pm, self.dev, title="Other work")
        response = self.client.get("/api/people/?paginated=1&q=Unique")
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["active_tasks"], 5)

    def test_task_progress_counts_do_not_multiply_with_multiple_assignees(self):
        task = make_task(self.project, self.pm, self.dev, self.other)
        SubTask.objects.create(task=task, title="One", is_done=True)
        SubTask.objects.create(task=task, title="Two")
        response = self.client.get("/api/tasks/")
        self.assertEqual(response.data["results"][0]["subtasks_progress"], {"total": 2, "done": 1})

    def test_developer_search_and_selected_user_work_beyond_the_first_200(self):
        from apps.accounts.models import User
        User.objects.bulk_create([
            User(username=f"lookup-{i}", first_name=f"A{i:03}", role=Role.DEVELOPER, is_active=True)
            for i in range(205)
        ])
        target = make_user(Role.DEVELOPER)
        target.first_name = "ZZ_unique_lookup"
        target.save(update_fields=["first_name"])
        first = self.client.get("/api/developers/")
        self.assertEqual(len(first.data), 200)
        self.assertNotIn(target.pk, [row["id"] for row in first.data])
        searched = self.client.get("/api/developers/?q=ZZ_unique_lookup")
        self.assertEqual([row["id"] for row in searched.data], [target.pk])
        selected = self.client.get(f"/api/developers/?q=missing&ids={target.pk}")
        self.assertEqual([row["id"] for row in selected.data], [target.pk])

    @override_settings(MAX_UNPAGED_ROWS=2)
    def test_unpaged_lists_reject_overflow_instead_of_silent_truncation(self):
        for _ in range(3):
            make_task(self.project, self.pm, self.dev)
        self.assertEqual(self.client.get("/api/tasks/?all=1").status_code, 400)
        self.assertEqual(self.client.get("/api/tasks/").data["count"], 3)

    def test_calendar_returns_complete_counts_and_bounded_previews(self):
        now = timezone.now()
        for _ in range(7):
            make_task(self.project, self.pm, self.dev, due_at=now)
        make_task(self.project, self.pm, self.other, due_at=now)
        make_task(self.project, self.pm, self.dev, due_at=now, archived_at=now)
        day = timezone.localdate().isoformat()
        response = client_for(self.dev).get(f"/api/calendar/?start={day}&end={day}")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["task_counts"][day], 7)
        self.assertEqual(len(response.data["tasks"]), 3)
        self.assertEqual(self.client.get("/api/calendar/?start=2026-01-01&end=2026-12-31").status_code, 400)
