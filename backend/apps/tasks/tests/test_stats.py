from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from apps.accounts.models import Role
from apps.panel.tests.factories import client_for, make_project, make_task, make_user


class TaskStatsTests(TestCase):
    def setUp(self):
        self.pm = make_user(Role.PM)
        self.dev = make_user(Role.DEVELOPER)
        self.other_dev = make_user(Role.DEVELOPER)
        project = make_project(self.pm, self.dev, self.other_dev)
        now = timezone.now()
        make_task(project, self.pm, self.dev, title="A", status="control")
        make_task(project, self.pm, self.dev, title="B", status="in_progress", due_at=now - timedelta(days=1))
        make_task(project, self.pm, self.other_dev, title="C", status="in_review")
        make_task(project, self.pm, self.dev, title="D", status="done", completed_at=now)
        make_task(project, self.pm, self.other_dev, title="E", status="done", completed_at=now)

    def stats(self, user):
        r = client_for(user).get("/api/tasks/stats/")
        self.assertEqual(r.status_code, 200, r.data)
        return r.data

    def test_manager_sees_everything(self):
        data = self.stats(self.pm)
        self.assertEqual(data["totals"], {"all": 5, "in_progress": 1, "in_review": 1, "done": 2, "overdue": 1})
        self.assertEqual(data["tabs"], {"all": 5, "control": 1, "in_progress": 1, "in_review": 1, "done": 2})
        self.assertEqual(data["series"]["done"][-1], 2)

    def test_developer_numbers_match_his_own_list(self):
        data = self.stats(self.dev)
        listed = client_for(self.dev).get("/api/tasks/?mine=1").data["count"]
        self.assertEqual(data["totals"]["all"], listed)
        self.assertEqual(data["tabs"], {"all": 3, "control": 1, "in_progress": 1, "in_review": 0, "done": 1})

    def test_archived_tasks_not_counted(self):
        from apps.tasks.models import Task
        Task.objects.filter(title="A").update(archived_at=timezone.now())
        self.assertEqual(self.stats(self.pm)["totals"]["all"], 4)
