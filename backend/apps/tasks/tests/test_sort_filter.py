from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from apps.accounts.models import Role
from apps.panel.tests.factories import client_for, make_project, make_task, make_user


class TaskSortAndFilterTests(TestCase):
    def setUp(self):
        self.pm = make_user(Role.PM)
        self.other_pm = make_user(Role.PM)
        self.dev = make_user(Role.DEVELOPER)
        self.project = make_project(self.pm, self.dev)
        now = timezone.now()
        self.late = make_task(self.project, self.pm, self.dev, title="Kechikkan", priority="low", due_at=now - timedelta(days=2))
        self.soon = make_task(self.project, self.pm, self.dev, title="Yaqin", priority="urgent", due_at=now + timedelta(days=1))
        self.far = make_task(self.project, self.other_pm, self.dev, title="Uzoq", priority="medium", due_at=now + timedelta(days=9))
        self.nodue = make_task(self.project, self.pm, self.dev, title="Muddatsiz", priority="high")

    def titles(self, query, user=None):
        r = client_for(user or self.pm).get(f"/api/tasks/?{query}")
        self.assertEqual(r.status_code, 200, r.data)
        return [t["title"] for t in r.data["results"]]

    def test_default_order_is_by_due_date(self):
        # Standart tartib o'zgarmagan (muddatsiz vazifaning o'rni bazaga bog'liq) — muddatlilar muddat bo'yicha
        self.assertEqual([t for t in self.titles("") if t != "Muddatsiz"], ["Kechikkan", "Yaqin", "Uzoq"])

    def test_sort_by_due_both_directions_with_missing_due_last(self):
        self.assertEqual(self.titles("sort=due"), ["Kechikkan", "Yaqin", "Uzoq", "Muddatsiz"])
        self.assertEqual(self.titles("sort=-due"), ["Uzoq", "Yaqin", "Kechikkan", "Muddatsiz"])

    def test_sort_by_priority_uses_rank_not_alphabet(self):
        # alifbo tartibida "high" < "low" < "medium" < "urgent" bo'lardi — bu noto'g'ri
        self.assertEqual(self.titles("sort=-priority"), ["Yaqin", "Muddatsiz", "Uzoq", "Kechikkan"])
        self.assertEqual(self.titles("sort=priority"), ["Kechikkan", "Uzoq", "Muddatsiz", "Yaqin"])

    def test_sort_by_created(self):
        self.assertEqual(self.titles("sort=-created")[0], "Muddatsiz")
        self.assertEqual(self.titles("sort=created")[0], "Kechikkan")

    def test_unknown_sort_is_ignored(self):
        self.assertEqual(self.titles("sort=password;drop"), self.titles(""))

    def test_created_by_me_filter(self):
        self.assertEqual(set(self.titles("created=me")), {"Kechikkan", "Yaqin", "Muddatsiz"})
        self.assertEqual(self.titles("created=me", user=self.other_pm), ["Uzoq"])

    def test_overdue_bucket_filter(self):
        self.assertEqual(self.titles("bucket=overdue"), ["Kechikkan"])

    def test_created_filter_cannot_widen_developer_visibility(self):
        # dasturchi o'zi yaratmagan vazifani `created=me` bilan ham ko'ra olmaydi, ko'rinadigani esa o'zgarmaydi
        self.assertEqual(self.titles("created=me", user=self.dev), [])
