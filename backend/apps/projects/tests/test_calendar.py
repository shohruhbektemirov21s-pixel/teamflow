"""Taqvim: loyihalar tugash sanasi bo'yicha (`end_from` / `end_to`, `all=1`) — ruxsatlar o'zgarmaydi."""
from datetime import date

from django.test import TestCase

from apps.accounts.models import Role
from apps.panel.tests.factories import client_for, make_project, make_user
from apps.projects.models import Project


class ProjectEndDateFilterTests(TestCase):
    def setUp(self):
        self.pm = make_user(Role.PM)
        self.dev = make_user(Role.DEVELOPER)
        self.mine = make_project(self.pm, self.dev, name="Meniki")
        self.other = make_project(self.pm, name="Boshqa")
        self.late = make_project(self.pm, self.dev, name="Keyinroq")
        Project.objects.filter(pk__in=[self.mine.pk, self.other.pk]).update(end_date=date(2026, 9, 30))
        Project.objects.filter(pk=self.late.pk).update(end_date=date(2026, 10, 5))

    def ids(self, user, **params):
        r = client_for(user).get("/api/projects/", {"all": 1, **params})
        self.assertEqual(r.status_code, 200, r.data)
        self.assertIsInstance(r.data, list)  # all=1 — sahifalanmaydi
        return {p["id"] for p in r.data}

    def test_single_day_includes_both_bounds(self):
        self.assertEqual(self.ids(self.pm, end_from="2026-09-30", end_to="2026-09-30"), {self.mine.pk, self.other.pk})

    def test_range(self):
        self.assertEqual(self.ids(self.pm, end_from="2026-10-01", end_to="2026-10-31"), {self.late.pk})

    def test_developer_sees_only_own_projects(self):
        self.assertEqual(self.ids(self.dev, end_from="2026-09-01", end_to="2026-10-31"), {self.mine.pk, self.late.pk})

    def test_department_sees_nothing(self):
        dept = make_user(Role.DEPARTMENT)
        self.assertEqual(self.ids(dept, end_from="2026-09-01", end_to="2026-10-31"), set())

    def test_without_all_is_paginated(self):
        r = client_for(self.pm).get("/api/projects/")
        self.assertIn("results", r.data)
