"""Jamoadan chiqarilgan dasturchi loyihaning tugallanmagan vazifalaridan ham olib tashlanadi."""
from django.test import TestCase

from apps.accounts.models import Role
from apps.panel.tests.factories import client_for, make_project, make_task, make_user
from apps.tasks.models import SubTask, Task, TaskAssignment


class SetMembersTests(TestCase):
    def setUp(self):
        self.pm = make_user(Role.PM)
        self.dev1 = make_user(Role.DEVELOPER)
        self.dev2 = make_user(Role.DEVELOPER)
        self.project = make_project(self.pm, self.dev1, self.dev2)

    def put(self, ids):
        return client_for(self.pm).put(f"/api/projects/{self.project.pk}/members/", {"member_ids": ids}, format="json")

    def test_removed_developer_leaves_open_tasks_and_subtasks(self):
        shared = make_task(self.project, self.pm, self.dev1, self.dev2)
        sub = SubTask.objects.create(task=shared, title="Qadam", assignee=self.dev2)
        done = make_task(self.project, self.pm, self.dev1, self.dev2, status=Task.Status.DONE)

        r = self.put([self.dev1.pk])

        self.assertEqual(r.status_code, 200, r.data)
        self.assertFalse(TaskAssignment.objects.filter(task=shared, developer=self.dev2).exists())
        sub.refresh_from_db()
        self.assertIsNone(sub.assignee)
        # Bajarilgan ish tarix sifatida qoladi
        self.assertTrue(TaskAssignment.objects.filter(task=done, developer=self.dev2).exists())
        # Endi u bu vazifani ko'rmaydi
        visible = client_for(self.dev2).get("/api/tasks/", {"all": 1}).data
        self.assertNotIn(shared.pk, [t["id"] for t in visible])

    def test_cannot_remove_sole_assignee_of_open_task(self):
        task = make_task(self.project, self.pm, self.dev2)

        r = self.put([self.dev1.pk])

        self.assertEqual(r.status_code, 400)
        self.assertIn(f"TSK-{task.pk}", r.data["detail"])
        self.assertTrue(self.project.memberships.filter(developer=self.dev2).exists())
        self.assertTrue(TaskAssignment.objects.filter(task=task, developer=self.dev2).exists())
