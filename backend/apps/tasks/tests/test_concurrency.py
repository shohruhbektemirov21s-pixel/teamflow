from concurrent.futures import ThreadPoolExecutor
from threading import Barrier

from django.db import connections
from django.test import TransactionTestCase, skipUnlessDBFeature

from apps.accounts.models import Role
from apps.core.models import ActivityLog
from apps.panel.tests.factories import client_for, make_project, make_task, make_user
from apps.tasks.models import Submission, Task


class TaskConcurrencyTests(TransactionTestCase):
    def setUp(self):
        self.pm = make_user(Role.PM)
        self.dev = make_user(Role.DEVELOPER)
        self.project = make_project(self.pm, self.dev)

    def race(self, path, payload):
        barrier = Barrier(2)
        def request(_):
            try:
                barrier.wait(timeout=10)
                return client_for(self.dev).post(path, payload, format="json").status_code
            finally:
                connections.close_all()
        with ThreadPoolExecutor(max_workers=2) as pool:
            return sorted(pool.map(request, range(2)))

    @skipUnlessDBFeature("has_select_for_update")
    def test_parallel_start_applies_transition_once(self):
        task = make_task(self.project, self.pm, self.dev)
        self.assertEqual(self.race(f"/api/tasks/{task.pk}/start/", {}), [200, 400])
        task.refresh_from_db()
        self.assertEqual(task.status, Task.Status.IN_PROGRESS)
        self.assertEqual(ActivityLog.objects.filter(verb="task_started").count(), 1)

    @skipUnlessDBFeature("has_select_for_update")
    def test_parallel_submit_creates_one_round(self):
        task = make_task(self.project, self.pm, self.dev, status=Task.Status.IN_PROGRESS)
        self.assertEqual(self.race(f"/api/tasks/{task.pk}/submit/", {"note": "Synthetic submission"}), [200, 400])
        self.assertEqual(Submission.objects.filter(task=task).count(), 1)
