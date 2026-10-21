"""Boshqarma bosh paneli: yil/oy/hafta boshidan — yuborilgan, rad etilgan, tasdiqlangan; son va ro'yxat bir xil."""
from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from apps.accounts.models import Role
from apps.core.periods import period_starts
from apps.orders.models import Order
from apps.panel.tests.factories import client_for, future, make_user


def make_order(user, title, status=Order.Status.SUBMITTED, created=None, decided=None):
    order = Order.objects.create(title=title, requested_due_date=future(), submitted_by=user, status=status, decided_at=decided)
    if created:
        Order.objects.filter(pk=order.pk).update(created_at=created)  # auto_now_add ni chetlab o'tish
    return order


class DepartmentDashboardTests(TestCase):
    def test_department_counts_use_one_query(self):
        from apps.orders.filters import department_dashboard
        from apps.orders.permissions import visible_orders
        with self.assertNumQueries(1):
            result = department_dashboard(visible_orders(self.dept))
        self.assertEqual(result["orders"]["submitted"], 1)

    def setUp(self):
        self.dept = make_user(Role.DEPARTMENT)
        self.other = make_user(Role.DEPARTMENT)
        now = timezone.now()
        week = period_starts()["week"]
        year = period_starts()["year"]
        before_week = week - timedelta(hours=1)
        self.long_ago = year - timedelta(days=1)
        make_order(self.dept, "Shu hafta yuborilgan")
        make_order(self.dept, "Shu hafta rad etilgan", Order.Status.REJECTED, decided=now)
        make_order(self.dept, "Loyiha bo'lgan", Order.Status.PROJECT_CREATED, decided=now)
        make_order(self.dept, "Avvalroq tasdiqlangan", Order.Status.APPROVED, created=before_week, decided=before_week)
        make_order(self.dept, "O'tgan yil", Order.Status.APPROVED, created=self.long_ago, decided=self.long_ago)
        make_order(self.other, "Begona", Order.Status.REJECTED, decided=now)

    def periods(self):
        data = client_for(self.dept).get("/api/dashboard/").data
        return data, {p["key"]: p["counts"] for p in data["periods"]}

    def test_period_counts_only_own_orders(self):
        data, periods = self.periods()
        self.assertEqual([p["key"] for p in data["periods"]], ["year", "month", "week"])
        self.assertEqual(periods["week"], {"sent": 3, "rejected": 1, "approved": 1})
        self.assertEqual(data["orders"], {"submitted": 1, "rejected": 1, "approved": 3})
        # Yil boshidan: o'tgan yilgi buyurtma kirmaydi
        self.assertEqual(periods["year"]["approved"], 2 if period_starts()["week"] > period_starts()["year"] else 1)

    def test_card_number_matches_list(self):
        _, periods = self.periods()
        client = client_for(self.dept)
        for period, counts in periods.items():
            for bucket, n in counts.items():
                with self.subTest(period=period, bucket=bucket):
                    r = client.get("/api/orders/", {"period": period, "bucket": bucket})
                    self.assertEqual(r.data["count"], n)
                    self.assertNotIn("Begona", [o["title"] for o in r.data["results"]])
