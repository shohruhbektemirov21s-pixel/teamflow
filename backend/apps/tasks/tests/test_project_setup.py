"""Loyiha yaratish oynasi: loyiha + har bir xodimga alohida vazifa (sana, fayl) — bitta tranzaksiyada."""
import json
from datetime import timedelta
from itertools import count

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.utils import timezone

from apps.accounts.models import Role
from apps.panel.tests.factories import client_for, dates, docx, make_user
from apps.projects.models import Project
from apps.tasks.models import Task

URL = "/api/projects/setup/"


class ProjectSetupTests(TestCase):
    _seq = count(1)

    def setUp(self):
        self.pm = make_user(Role.PM)
        self.dev1 = make_user(Role.DEVELOPER)
        self.dev2 = make_user(Role.DEVELOPER)
        self.outsider = make_user(Role.DEVELOPER)
        self.start = timezone.now().replace(microsecond=0)
        self.due = self.start + timedelta(days=3)

    def post(self, tasks, user=None, **extra):
        data = {"code": f"SETUP-{next(self._seq)}", "name": "Portal", **dates(),
                "member_ids": json.dumps([self.dev1.pk, self.dev2.pk]), "tasks": json.dumps(tasks), **extra}
        return client_for(user or self.pm).post(URL, data, format="multipart")

    def task(self, assignee, title="Vazifa", **kw):
        return {"title": title, "assignee_id": assignee.pk, "starts_at": self.start.isoformat(),
                "due_at": self.due.isoformat(), **kw}

    def test_creates_separate_tasks_per_developer_with_dates_and_files(self):
        r = self.post([self.task(self.dev1, "Backend API"), self.task(self.dev2, "Dizayn")],
                      task_files_1=docx("maket.pdf"))

        self.assertEqual(r.status_code, 201, r.data)
        project = Project.objects.get(pk=r.data["id"])
        self.assertEqual(r.data["code"], project.code)
        api_task = Task.objects.get(project=project, title="Backend API")
        design = Task.objects.get(project=project, title="Dizayn")
        self.assertEqual(list(api_task.assignees.all()), [self.dev1])
        self.assertEqual(list(design.assignees.all()), [self.dev2])
        self.assertEqual((api_task.starts_at, api_task.due_at), (self.start, self.due))
        self.assertEqual(api_task.files.count(), 0)
        self.assertEqual([f.original_name for f in design.files.all()], ["maket.pdf"])
        self.assertEqual(self.dev2.notifications.filter(kind="task_assigned").count(), 1)

    def test_failed_task_rolls_back_whole_project(self):
        r = self.post([self.task(self.dev1), self.task(self.outsider, "Begona")])

        self.assertEqual(r.status_code, 400)
        self.assertIn("2-topshiriq", r.data["detail"])
        self.assertFalse(Project.objects.exists())
        self.assertFalse(Task.objects.exists())

    def test_due_before_start_is_rejected(self):
        bad = self.task(self.dev1, due_at=(self.start - timedelta(days=1)).isoformat())
        r = self.post([bad])
        self.assertEqual(r.status_code, 400)
        self.assertFalse(Project.objects.exists())

    def test_task_file_type_is_checked(self):
        exe = SimpleUploadedFile("virus.exe", b"x", content_type="application/octet-stream")
        r = self.post([self.task(self.dev1)], task_files_0=exe)
        self.assertEqual(r.status_code, 400)
        self.assertIn("1-topshiriq fayli", str(r.data))
        self.assertFalse(Project.objects.exists())

    def test_only_managers(self):
        self.assertEqual(self.post([], user=self.dev1).status_code, 403)
        self.assertFalse(Project.objects.exists())

    def test_without_tasks_creates_just_project(self):
        r = self.post([])
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(Project.objects.get().memberships.count(), 2)

    def test_setup_cannot_select_pending_approval_directly(self):
        r = self.post([], stage=Project.Stage.PENDING_APPROVAL)
        self.assertEqual(r.status_code, 400)
        self.assertFalse(Project.objects.exists())
