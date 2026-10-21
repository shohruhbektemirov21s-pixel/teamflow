from django.test import TestCase

from apps.accounts.models import Role
from apps.panel.tests.factories import client_for, make_project, make_user


class ProjectStatsTests(TestCase):
    def setUp(self):
        self.pm = make_user(Role.PM)
        self.dev = make_user(Role.DEVELOPER)
        self.mine = make_project(self.pm, self.dev, name="Mening")
        self.other = make_project(self.pm, name="Boshqa")
        self.done = make_project(self.pm, self.dev, name="Tugagan")
        type(self.done).objects.filter(pk=self.done.pk).update(stage="done")

    def stats(self, user):
        r = client_for(user).get("/api/projects/stats/")
        self.assertEqual(r.status_code, 200, r.data)
        return r.data

    def test_manager_counts_and_tabs(self):
        data = self.stats(self.pm)
        self.assertEqual(data["totals"]["all"], 3)
        self.assertEqual(data["totals"]["done"], 1)
        self.assertEqual(data["tabs"]["done"], 1)
        self.assertEqual(len(data["series"]["all"]), 8)

    def test_developer_counts_only_his_projects_once(self):
        data = self.stats(self.dev)
        self.assertEqual(data["totals"]["all"], 2)
        self.assertEqual(data["tabs"]["all"], 2)

    def test_department_gets_zero(self):
        self.assertEqual(self.stats(make_user(Role.DEPARTMENT))["totals"]["all"], 0)
