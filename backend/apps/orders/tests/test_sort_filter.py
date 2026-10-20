from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from apps.accounts.models import Role
from apps.orders.models import Order
from apps.panel.tests.factories import client_for, make_user


class OrderSortAndFilterTests(TestCase):
    def setUp(self):
        self.dept = make_user(Role.DEPARTMENT)
        self.pm = make_user(Role.PM)
        today = timezone.localdate()

        def make(title, priority, days, status=Order.Status.SUBMITTED):
            return Order.objects.create(title=title, priority=priority, requested_due_date=today + timedelta(days=days),
                                        submitted_by=self.dept, status=status)

        self.a = make("Yaqin", "low", 2)
        self.b = make("Uzoq", "urgent", 30)
        self.c = make("Kechikkan", "medium", -3)
        self.d = make("Rad etilgan", "high", 1, Order.Status.REJECTED)

    def titles(self, query, user=None):
        r = client_for(user or self.pm).get(f"/api/orders/?{query}")
        self.assertEqual(r.status_code, 200, r.data)
        return [o["title"] for o in r.data["results"]]

    def test_default_is_newest_first(self):
        self.assertEqual(self.titles(""), ["Rad etilgan", "Kechikkan", "Uzoq", "Yaqin"])

    def test_sort_by_due(self):
        self.assertEqual(self.titles("sort=due"), ["Kechikkan", "Rad etilgan", "Yaqin", "Uzoq"])
        self.assertEqual(self.titles("sort=-due"), ["Uzoq", "Yaqin", "Rad etilgan", "Kechikkan"])

    def test_sort_by_priority(self):
        self.assertEqual(self.titles("sort=-priority"), ["Uzoq", "Rad etilgan", "Kechikkan", "Yaqin"])

    def test_explicit_sort_applies_to_department_too(self):
        self.assertEqual(self.titles("sort=due", user=self.dept), ["Kechikkan", "Rad etilgan", "Yaqin", "Uzoq"])

    def test_due_soon_includes_overdue_but_not_rejected_or_far(self):
        self.assertEqual(set(self.titles("due_soon=1")), {"Yaqin", "Kechikkan"})

    def test_due_soon_hides_orders_with_finished_project(self):
        from apps.panel.tests.factories import make_project
        project = make_project(self.pm)
        project.order = self.a
        project.stage = "done"
        project.save()
        self.assertEqual(set(self.titles("due_soon=1")), {"Kechikkan"})

    def test_unknown_sort_is_ignored(self):
        self.assertEqual(self.titles("sort=__bad__"), self.titles(""))
