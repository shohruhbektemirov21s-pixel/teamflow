"""Kodlar (TSK-12 / PRJ-3): qidiruvda kod yozilsa aynan o'sha yozuv chiqadi, ko'rish huquqi saqlanadi."""
from django.test import TestCase

from apps.accounts.models import Role
from apps.core.codes import parse_code
from apps.panel.tests.factories import client_for, make_project, make_task, make_user


class ParseCodeTests(TestCase):
    def test_variants(self):
        self.assertEqual(parse_code("TSK-12"), ("task", 12))
        self.assertEqual(parse_code(" tsk12 "), ("task", 12))
        self.assertEqual(parse_code("prj-3"), ("project", 3))
        self.assertIsNone(parse_code("12"))
        self.assertIsNone(parse_code("TSK-"))
        self.assertIsNone(parse_code("Portal"))


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
        data = self.search(self.pm, f"TSK-{self.task.pk}")
        self.assertEqual([t["id"] for t in data["tasks"]], [self.task.pk])
        self.assertEqual(data["tasks"][0]["code"], f"TSK-{self.task.pk}")
        self.assertEqual(data["projects"], [])

    def test_project_code_returns_exactly_that_project(self):
        data = self.search(self.pm, f"prj{self.second.pk}")
        self.assertEqual([p["id"] for p in data["projects"]], [self.second.pk])
        self.assertEqual(data["tasks"], [])

    def test_code_respects_visibility(self):
        self.assertEqual(self.search(self.dev, f"TSK-{self.foreign.pk}")["tasks"], [])
        self.assertEqual(self.search(self.dev, f"PRJ-{self.second.pk}")["projects"], [])

    def test_task_list_project_code_filters_by_project_not_task_id(self):
        r = client_for(self.pm).get("/api/tasks/", {"q": f"PRJ-{self.second.pk}", "all": 1})
        self.assertEqual([t["title"] for t in r.data], ["Boshqa loyiha vazifasi"])
        self.assertEqual(r.data[0]["project"]["code"], f"PRJ-{self.second.pk}")

    def test_task_list_task_code_keeps_other_filters(self):
        r = client_for(self.pm).get("/api/tasks/", {"q": f"TSK-{self.task.pk}", "status": "done", "all": 1})
        self.assertEqual(r.data, [])
