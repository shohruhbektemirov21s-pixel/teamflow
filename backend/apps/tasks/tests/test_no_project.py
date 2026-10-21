"""Dasturchi loyihasiz vazifa yarata oladi; PM/Boshliq uchun loyiha majburiy."""
from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from apps.accounts.models import Role
from apps.notifications.models import Notification
from apps.panel.tests.factories import client_for, make_user
from apps.projects.models import ProjectMember
from apps.tasks.models import Task


class NoProjectTaskTests(TestCase):
    def setUp(self):
        self.pm = make_user(Role.PM)
        self.boss = make_user(Role.BOSS)
        self.dev = make_user(Role.DEVELOPER)
        self.other = make_user(Role.DEVELOPER)

    def create(self, user=None, **kw):
        data = {"title": "O'qish rejasi", "due_at": (timezone.now() + timedelta(days=2)).isoformat(),
                "assignee_ids": [self.other.pk], "subtasks": [{"title": "1-bob", "assignee_ids": [self.other.pk]}]}
        data.update(kw)
        return client_for(user or self.dev).post("/api/tasks/", data, format="json")

    def test_developer_creates_task_without_project_for_self(self):
        for payload in ({}, {"project": None}):
            r = self.create(**payload)
            self.assertEqual(r.status_code, 201, r.data)
            self.assertIsNone(r.data["project"])
            self.assertEqual([a["id"] for a in r.data["assignees"]], [self.dev.pk])  # faqat o'ziga
            self.assertEqual([a["id"] for a in r.data["subtasks"][0]["assignees"]], [self.dev.pk])
        self.assertEqual(Task.objects.filter(project__isnull=True).count(), 2)
        self.assertFalse(ProjectMember.objects.exists())

    def test_managers_still_must_choose_project(self):
        for user in (self.pm, self.boss):
            r = self.create(user)
            self.assertEqual(r.status_code, 400)
            self.assertIn("project", r.data["fields"])
        for user in (make_user(Role.DEPARTMENT), make_user(Role.USER)):
            self.assertEqual(self.create(user).status_code, 400)
        self.assertFalse(Task.objects.exists())

    def test_projectless_task_shows_everywhere_without_errors(self):
        tid = self.create().data["id"]
        dev, pm = client_for(self.dev), client_for(self.pm)
        self.assertEqual(dev.get(f"/api/tasks/{tid}/").data["project"], None)
        self.assertIn(tid, [t["id"] for t in dev.get("/api/tasks/").data["results"]])
        self.assertIn(tid, [t["id"] for t in pm.get("/api/tasks/").data["results"]])
        self.assertEqual(client_for(self.other).get(f"/api/tasks/{tid}/").status_code, 404)
        self.assertEqual(pm.get("/api/search/", {"q": "O'qish"}).data["tasks"][0]["project"], "")
        row = next(p for p in pm.get("/api/people/").data if p["id"] == self.dev.pk)
        self.assertEqual((row["work"][0]["id"], row["work"][0]["project"]), (tid, None))
        self.assertEqual(pm.get("/api/dashboard/").status_code, 200)

    def test_lifecycle_and_reviewers_without_project(self):
        tid = self.create().data["id"]
        dev = client_for(self.dev)
        self.assertEqual(dev.post(f"/api/tasks/{tid}/start/").status_code, 200)
        self.assertEqual(dev.post(f"/api/tasks/{tid}/submit/", {"note": "Tayyor"}).status_code, 200)
        # Loyiha egasi yo'q, vazifani dasturchi yaratgan — barcha menejerlarga xabar
        self.assertEqual(set(Notification.objects.filter(kind="task_submitted").values_list("recipient_id", flat=True)),
                         {self.pm.pk, self.boss.pk})
        r = client_for(self.pm).post(f"/api/tasks/{tid}/review/", {"decision": "accept"})
        self.assertEqual(r.data["status"], "done")
        self.assertEqual(client_for(self.pm).get("/api/workdone/").status_code, 200)
        self.assertEqual(client_for(self.boss).get(f"/api/portfolio/{self.dev.pk}/").status_code, 200)

    def test_creator_adds_any_active_developer_without_project_team(self):
        tid = self.create().data["id"]
        dev = client_for(self.dev)
        r = dev.put(f"/api/tasks/{tid}/assignees/", {"assignee_ids": [self.dev.pk, self.other.pk]}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual({a["id"] for a in r.data["assignees"]}, {self.dev.pk, self.other.pk})
        r = dev.post(f"/api/tasks/{tid}/subtasks/", {"title": "2-bob", "assignee_ids": [self.other.pk]}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertFalse(ProjectMember.objects.exists())
        blocked = make_user(Role.DEVELOPER, active=False)
        r = dev.put(f"/api/tasks/{tid}/assignees/", {"assignee_ids": [self.dev.pk, blocked.pk]}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_manager_edits_projectless_task(self):
        tid = self.create().data["id"]
        r = client_for(self.pm).patch(f"/api/tasks/{tid}/", {"title": "Yangi nom", "assignee_ids": [self.other.pk],
                                                             "subtasks": [{"title": "A", "assignee_ids": [self.other.pk]}]},
                                      format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual((r.data["title"], [a["id"] for a in r.data["assignees"]]), ("Yangi nom", [self.other.pk]))
        self.assertTrue(r.data["actions"]["manage_assignees"])
