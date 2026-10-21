from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from apps.accounts.models import Role
from apps.orders.models import Order
from apps.panel.tests.factories import client_for, make_project, make_user


class OrderStatsAndFilterTests(TestCase):
    def setUp(self):
        self.pm = make_user(Role.PM)
        self.dept = make_user(Role.DEPARTMENT, department_name="IT boshqarma")
        self.other = make_user(Role.DEPARTMENT, department_name="Moliya boshqarma")
        today = timezone.localdate()

        def make(title, user, priority="medium", status=Order.Status.SUBMITTED):
            return Order.objects.create(title=title, priority=priority, requested_due_date=today + timedelta(days=5),
                                        submitted_by=user, status=status)

        self.new = make("Yangi", self.dept)
        self.urgent = make("Shoshilinch", self.dept, "urgent")
        self.rejected = make("Rad", self.dept, "urgent", Order.Status.REJECTED)
        self.planned = make("Reja", self.other, status=Order.Status.PROJECT_CREATED)
        self.done = make("Tugagan", self.other, "urgent", Order.Status.PROJECT_CREATED)
        for order, stage in ((self.planned, "planned"), (self.done, "done")):
            project = make_project(self.pm)
            project.order, project.stage = order, stage
            project.save()

    def get(self, path, user=None):
        r = client_for(user or self.pm).get(path)
        self.assertEqual(r.status_code, 200, r.data)
        return r.data

    def test_stats_cards_and_tabs(self):
        data = self.get("/api/orders/stats/")
        self.assertEqual(data["totals"], {"all": 5, "submitted": 2, "planned": 1, "done": 1, "urgent": 1})
        self.assertEqual(data["tabs"], {"all": 5, "submitted": 2, "approved": 2, "rejected": 1, "done": 1})
        self.assertEqual(data["departments"], ["IT boshqarma", "Moliya boshqarma"])

    def test_stats_series_covers_eight_weeks_and_this_week(self):
        data = self.get("/api/orders/stats/")
        self.assertEqual(len(data["series"]["all"]), 8)
        self.assertEqual(data["series"]["all"][-1], 5)  # hammasi shu hafta yaratildi
        self.assertEqual(sum(data["series"]["all"]), data["totals"]["all"])

    def test_department_sees_only_own_numbers_and_no_department_list(self):
        data = self.get("/api/orders/stats/", user=self.dept)
        self.assertEqual(data["totals"]["all"], 3)
        self.assertEqual(data["departments"], [])

    def test_developer_gets_nothing(self):
        data = self.get("/api/orders/stats/", user=make_user(Role.DEVELOPER))
        self.assertEqual(data["totals"]["all"], 0)

    def titles(self, query):
        return {o["title"] for o in self.get(f"/api/orders/?{query}")["results"]}

    def test_stage_priority_department_filters(self):
        self.assertEqual(self.titles("stage=done"), {"Tugagan"})
        self.assertEqual(self.titles("priority=urgent"), {"Shoshilinch", "Rad", "Tugagan"})
        self.assertEqual(self.titles("department=IT boshqarma"), {"Yangi", "Shoshilinch", "Rad"})

    def test_sent_date_range(self):
        today = timezone.localdate()
        self.assertEqual(len(self.titles(f"sent_from={today}&sent_to={today}")), 5)
        self.assertEqual(self.titles(f"sent_from={today + timedelta(days=1)}"), set())
        self.assertEqual(len(self.titles("sent_from=not-a-date")), 5)

    def test_page_size(self):
        data = self.get("/api/orders/?page_size=2")
        self.assertEqual(len(data["results"]), 2)
        self.assertEqual(data["count"], 5)
