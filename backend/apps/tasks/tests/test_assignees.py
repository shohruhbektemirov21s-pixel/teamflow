"""Vazifa oynasidan ijrochilar: bir nechta dasturchi, sub-vazifaga bir nechta ijrochi, jamoaga avtomatik qo'shish."""
from django.test import TestCase

from apps.accounts.models import Role
from apps.notifications.models import Notification
from apps.panel.tests.factories import client_for, make_project, make_task, make_user
from apps.tasks.models import SubTask, Task


class TaskAssigneesTests(TestCase):
    def setUp(self):
        self.pm = make_user(Role.PM)
        self.dev = make_user(Role.DEVELOPER)
        self.mate = make_user(Role.DEVELOPER)
        self.outsider = make_user(Role.DEVELOPER)  # loyiha jamoasida emas
        self.project = make_project(self.pm, self.dev, self.mate)

    def put(self, user, task, ids):
        return client_for(user).put(f"/api/tasks/{task.pk}/assignees/", {"assignee_ids": ids}, format="json")

    def test_manager_adds_several_and_outsider_joins_team(self):
        task = make_task(self.project, self.pm, self.dev)
        r = self.put(self.pm, task, [self.dev.pk, self.mate.pk, self.outsider.pk])
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual({u["id"] for u in r.data["assignees"]}, {self.dev.pk, self.mate.pk, self.outsider.pk})
        self.assertTrue(self.project.memberships.filter(developer=self.outsider).exists())
        # yangi qo'shilganlarga bildirishnoma, eski ijrochiga yo'q
        notified = set(Notification.objects.filter(kind=Notification.Kind.TASK_ASSIGNED).values_list("recipient_id", flat=True))
        self.assertEqual(notified, {self.mate.pk, self.outsider.pk})

    def test_creator_developer_can_add_others(self):
        task = make_task(self.project, self.dev, self.dev)  # dasturchi o'zi yaratgan ("Mening ishim")
        detail = client_for(self.dev).get(f"/api/tasks/{task.pk}/").data
        self.assertTrue(detail["actions"]["manage_assignees"])
        r = self.put(self.dev, task, [self.dev.pk, self.mate.pk])
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual({u["id"] for u in r.data["assignees"]}, {self.dev.pk, self.mate.pk})

    def test_creator_developer_cannot_remove_self(self):
        task = make_task(self.project, self.dev, self.dev)
        self.assertEqual(self.put(self.dev, task, [self.mate.pk]).status_code, 400)

    def test_non_creator_developer_cannot_change(self):
        task = make_task(self.project, self.pm, self.dev)  # menejer bergan vazifa
        self.assertFalse(client_for(self.dev).get(f"/api/tasks/{task.pk}/").data["actions"]["manage_assignees"])
        self.assertEqual(self.put(self.dev, task, [self.dev.pk, self.mate.pk]).status_code, 400)
        self.assertEqual(task.assignments.count(), 1)

    def test_invalid_input(self):
        task = make_task(self.project, self.pm, self.dev)
        pm_user = make_user(Role.PM)
        for ids in ([], [pm_user.pk], [make_user(Role.DEVELOPER, active=False).pk]):
            with self.subTest(ids=ids):
                self.assertEqual(self.put(self.pm, task, ids).status_code, 400)
        self.assertEqual(task.assignments.count(), 1)

    def test_done_task_is_locked(self):
        task = make_task(self.project, self.pm, self.dev, status=Task.Status.DONE)
        self.assertEqual(self.put(self.pm, task, [self.dev.pk, self.mate.pk]).status_code, 400)


class SubtaskAssigneesTests(TestCase):
    def setUp(self):
        self.pm = make_user(Role.PM)
        self.dev = make_user(Role.DEVELOPER)
        self.mate = make_user(Role.DEVELOPER)
        self.outsider = make_user(Role.DEVELOPER)
        self.project = make_project(self.pm, self.dev, self.mate)
        self.task = make_task(self.project, self.pm, self.dev)

    def test_add_subtask_with_several_assignees(self):
        r = client_for(self.dev).post(f"/api/tasks/{self.task.pk}/subtasks/",
                                      {"title": "Test yozish", "assignee_ids": [self.mate.pk, self.outsider.pk]},
                                      format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual({u["id"] for u in r.data["subtasks"][0]["assignees"]}, {self.mate.pk, self.outsider.pk})
        self.assertTrue(self.project.memberships.filter(developer=self.outsider).exists())

    def test_change_subtask_assignees(self):
        sub = SubTask.objects.create(task=self.task, title="Qadam")
        sub.assignees.add(self.mate)
        url = f"/api/tasks/{self.task.pk}/subtasks/{sub.pk}/"
        r = client_for(self.pm).patch(url, {"assignee_ids": [self.mate.pk, self.outsider.pk]}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual({u.pk for u in sub.assignees.all()}, {self.mate.pk, self.outsider.pk})
        # olib tashlash: bo'sh ro'yxat — ijrochisiz
        r = client_for(self.pm).patch(url, {"assignee_ids": []}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertFalse(sub.assignees.exists())

    def test_subtask_assignee_sees_task_and_toggles(self):
        sub = SubTask.objects.create(task=self.task, title="Qadam")
        sub.assignees.set([self.mate, self.outsider])
        for user in (self.mate, self.outsider):
            with self.subTest(user=user.username):
                r = client_for(user).post(f"/api/tasks/{self.task.pk}/subtasks/{sub.pk}/toggle/", {"is_done": True})
                self.assertEqual(r.status_code, 200)

    def test_only_manager_or_task_assignee_changes_subtask(self):
        sub = SubTask.objects.create(task=self.task, title="Qadam")
        sub.assignees.add(self.mate)  # sub-vazifa ijrochisi, lekin vazifa ijrochisi emas
        r = client_for(self.mate).patch(f"/api/tasks/{self.task.pk}/subtasks/{sub.pk}/",
                                        {"assignee_ids": [self.mate.pk, self.outsider.pk]}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertEqual(list(sub.assignees.all()), [self.mate])

    def test_form_keeps_several_subtask_assignees(self):
        r = client_for(self.pm).patch(f"/api/tasks/{self.task.pk}/", {
            "subtasks": [{"title": "Birga", "assignee_ids": [self.dev.pk, self.mate.pk]}],
        }, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual({u.pk for u in self.task.subtasks.get().assignees.all()}, {self.dev.pk, self.mate.pk})
