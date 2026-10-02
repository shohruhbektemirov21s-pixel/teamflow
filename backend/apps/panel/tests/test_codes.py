"""Kodlar: vazifa tasodifiy 9 xonali kod oladi, loyiha raqami qo'lda kiritiladi; qidiruvda kod
yozilsa aynan o'sha yozuv chiqadi."""
from django.test import TestCase

from apps.accounts.models import Role
from apps.core.codes import looks_like_code, resolve_code
from apps.panel.tests.factories import client_for, make_project, make_task, make_user


class CodeGenerationTests(TestCase):
    def test_task_gets_unique_9_digit_code_project_keeps_manual_code(self):
        pm = make_user(Role.PM)
        dev = make_user(Role.DEVELOPER)
        project = make_project(pm, dev, code="PRJ-CG-1")
        task = make_task(project, pm, dev)
        self.assertTrue(looks_like_code(task.code))
        self.assertEqual(project.code, "PRJ-CG-1")
        self.assertNotEqual(project.code, task.code)

    def test_resolve_code_variants(self):
        pm = make_user(Role.PM)
        dev = make_user(Role.DEVELOPER)
        project = make_project(pm, dev, code="RC-1")
        task = make_task(project, pm, dev)
        self.assertEqual(resolve_code(task.code), ("task", task.pk))
        self.assertEqual(resolve_code(f" {project.code} "), ("project", project.pk))
        self.assertIsNone(resolve_code("12"))
        self.assertIsNone(resolve_code("TSK-12"))
        self.assertIsNone(resolve_code("Portal"))
        self.assertIsNone(resolve_code("123456789"))  # mavjud bo'lmagan kod


class CodeSearchTests(TestCase):
    def setUp(self):
        self.pm = make_user(Role.PM)
        self.dev = make_user(Role.DEVELOPER)
        self.other = make_user(Role.DEVELOPER)
        self.project = make_project(self.pm, self.dev, self.other)
        self.task = make_task(self.project, self.pm, self.dev, title="Kirish sahifasi")
        self.foreign = make_task(self.project, self.pm, self.other, title="Begona vazifa")
        self.second = make_project(self.pm, name="Boshqa loyiha")
        make_task(self.second, self.pm, title="Boshqa loyiha vazifasi")

    def search(self, user, q):
        return client_for(user).get("/api/search/", {"q": q}).data

    def test_task_code_returns_exactly_that_task(self):
        data = self.search(self.pm, self.task.code)
        self.assertEqual([t["id"] for t in data["tasks"]], [self.task.pk])
        self.assertEqual(data["tasks"][0]["code"], self.task.code)
        self.assertEqual(data["projects"], [])

    def test_project_code_returns_exactly_that_project(self):
        data = self.search(self.pm, f" {self.second.code} ")
        self.assertEqual([p["id"] for p in data["projects"]], [self.second.pk])
        self.assertEqual(data["tasks"], [])

    def test_code_respects_visibility(self):
        self.assertEqual(self.search(self.dev, self.foreign.code)["tasks"], [])
        self.assertEqual(self.search(self.dev, self.second.code)["projects"], [])

    def test_task_list_project_code_filters_by_project_not_task_id(self):
        r = client_for(self.pm).get("/api/tasks/", {"q": self.second.code, "all": 1})
        self.assertEqual([t["title"] for t in r.data], ["Boshqa loyiha vazifasi"])
        self.assertEqual(r.data[0]["project"]["code"], self.second.code)

    def test_task_list_task_code_keeps_other_filters(self):
        r = client_for(self.pm).get("/api/tasks/", {"q": self.task.code, "status": "done", "all": 1})
        self.assertEqual(r.data, [])


class DeveloperListsOwnTasksTests(TestCase):
    """Dasturchiga ro'yxat va qidiruvda faqat o'ziga biriktirilgan vazifalar; sub-vazifali boshqa vazifa ochiladi."""

    def setUp(self):
        from apps.tasks.models import SubTask

        self.pm = make_user(Role.PM)
        self.dev = make_user(Role.DEVELOPER)
        self.other = make_user(Role.DEVELOPER)
        project = make_project(self.pm, self.dev, self.other)
        self.own = make_task(project, self.pm, self.dev, title="Mening vazifam")
        self.foreign = make_task(project, self.pm, self.other, title="Boshqaning vazifasi")
        SubTask.objects.create(task=self.foreign, title="Kichik qadam").assignees.add(self.dev)

    def test_search_hides_subtask_only_task(self):
        c = client_for(self.dev)
        self.assertEqual([t["id"] for t in c.get("/api/search/", {"q": "vazifa"}).data["tasks"]], [self.own.pk])
        self.assertEqual(c.get("/api/search/", {"q": self.foreign.code}).data["tasks"], [])

    def test_mine_list_and_dashboard_count_only_own(self):
        c = client_for(self.dev)
        self.assertEqual([t["id"] for t in c.get("/api/tasks/", {"mine": 1, "all": 1}).data], [self.own.pk])
        self.assertEqual(c.get("/api/dashboard/").data["totals"]["active"], 1)
        self.assertEqual(c.get(f"/api/tasks/{self.foreign.pk}/").status_code, 200)

    def test_manager_search_sees_all(self):
        ids = {t["id"] for t in client_for(self.pm).get("/api/search/", {"q": "vazifa"}).data["tasks"]}
        self.assertEqual(ids, {self.own.pk, self.foreign.pk})
