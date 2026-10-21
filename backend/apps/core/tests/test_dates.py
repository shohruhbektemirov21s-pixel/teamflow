"""Muddat sanalari: bugundan oldingi sana kiritilmaydi (core/dates.py) — har bir kiritish joyi va chegaralar."""
from datetime import timedelta
from io import StringIO

from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone

from apps.accounts.models import Role
from apps.core.api_utils import ServiceError
from apps.core.dates import ensure_not_past
from apps.orders import services as orders
from apps.panel.tests.factories import client_for, docx, make_project, make_task, make_user
from apps.projects import services as projects
from apps.tasks import services as tasks


def day(n=0):
    return timezone.localdate() + timedelta(days=n)


class EnsureNotPastTests(TestCase):
    def test_today_and_future_allowed_past_rejected(self):
        ensure_not_past(day(0), "d")
        ensure_not_past(day(1), "d")
        ensure_not_past(None, "d")
        ensure_not_past(timezone.now() - timedelta(minutes=1), "d")  # bugun, lekin biroz oldin — mumkin
        for value in (day(-1), timezone.now() - timedelta(days=1)):
            with self.assertRaises(ServiceError) as ctx:
                ensure_not_past(value, "d")
            self.assertEqual(ctx.exception.field, "d")

    def test_unchanged_old_value_is_not_checked(self):
        old = timezone.now() - timedelta(days=3)
        ensure_not_past(day(-3), "d", previous=day(-3))
        ensure_not_past(old.replace(second=0, microsecond=0), "d", previous=old)  # forma soniyani tashlaydi


class PastDateEntryPointsTests(TestCase):
    def setUp(self):
        self.pm = make_user(Role.PM)
        self.dev = make_user(Role.DEVELOPER)
        self.dept = make_user(Role.DEPARTMENT)
        self.project = make_project(self.pm, self.dev)

    def assert_field_error(self, field, fn, *args, **kwargs):
        with self.assertRaises(ServiceError) as ctx:
            fn(*args, **kwargs)
        self.assertEqual(ctx.exception.field, field)

    def test_task_create_and_api(self):
        yesterday = timezone.now() - timedelta(days=1)
        self.assert_field_error("due_at", tasks.create_task, self.pm, self.project, title="T",
                                due_at=yesterday, assignee_ids=[self.dev.pk])
        self.assert_field_error("starts_at", tasks.create_task, self.pm, self.project, title="T",
                                starts_at=yesterday, assignee_ids=[self.dev.pk])
        r = client_for(self.pm).post("/api/tasks/", {"project": self.project.pk, "title": "T",
                                                     "assignee_ids": [self.dev.pk], "due_at": yesterday.isoformat()},
                                     format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("due_at", r.data["fields"])
        self.assertTrue(tasks.create_task(self.pm, self.project, title="Bugun", due_at=timezone.now() + timedelta(minutes=5),
                                          assignee_ids=[self.dev.pk]).pk)

    def test_task_update_keeps_unchanged_overdue_but_rejects_new_past(self):
        task = make_task(self.project, self.pm, self.dev, due_at=timezone.now() - timedelta(days=2))
        tasks.update_task(task, self.pm, title="Yangi nom", due_at=task.due_at)
        self.assert_field_error("due_at", tasks.update_task, task, self.pm, due_at=timezone.now() - timedelta(days=1))
        tasks.update_task(task, self.pm, due_at=timezone.now() + timedelta(days=1))

    def test_bulk_and_project_setup_tasks(self):
        past = (timezone.now() - timedelta(days=1)).isoformat()
        r = client_for(self.pm).post("/api/tasks/bulk/", {"project": self.project.pk, "tasks": [
            {"title": "A", "assignee_ids": [self.dev.pk], "due_at": past}]}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_project_create_and_update(self):
        self.assert_field_error("start_date", projects.create_project, self.pm, code="P-PAST", name="P",
                                start_date=day(-1), end_date=day(5))
        self.assert_field_error("end_date", projects.create_project, self.pm, code="P-PAST", name="P",
                                start_date=day(0), end_date=day(-1))
        old = make_project(self.pm, name="Eski")
        type(old).objects.filter(pk=old.pk).update(start_date=day(-10), end_date=day(-2))
        old.refresh_from_db()
        projects.update_project(old, self.pm, name="Yangi", start_date=old.start_date, end_date=old.end_date)
        self.assert_field_error("end_date", projects.update_project, old, self.pm, end_date=day(-1))
        projects.update_project(old, self.pm, end_date=day(3))
        r = client_for(self.pm).post("/api/projects/", {"code": "API-PAST", "name": "P",
                                                        "start_date": day(-1).isoformat(), "end_date": day(2).isoformat()},
                                     format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("start_date", r.data["fields"])

    def test_orders(self):
        self.assert_field_error("requested_due_date", orders.create_order, self.dept, title="O", description="",
                                priority="medium", requested_due_date=day(-1), file=docx())
        order = orders.create_order(self.dept, title="O", description="", priority="medium",
                                    requested_due_date=day(0), file=docx())
        self.assert_field_error("start_date", orders.approve_order, order, self.pm, start_date=day(-1), end_date=day(5))
        orders.approve_order(order, self.pm, start_date=day(0), end_date=day(5))
        order.refresh_from_db()
        self.assert_field_error("start_date", orders.update_order_dates, order, self.pm, start_date=day(-1), end_date=day(5))
        # Tasdiqlangan sana keyinroq o'tib ketsa ham, buyurtmadan loyiha shu sanalar bilan yaratiladi
        type(order).objects.filter(pk=order.pk).update(start_date=day(-3))
        order.refresh_from_db()
        self.assert_field_error("end_date", orders.update_order_dates, order, self.pm, start_date=day(-3), end_date=day(-1))
        project = projects.create_project(self.pm, code="FROM-ORDER", order=order)
        self.assertEqual(project.start_date, day(-3))
        orders.update_order_dates(order, self.pm, start_date=day(-3), end_date=day(6))  # boshlanish o'zgarmadi

    def test_portfolio_and_worklog_dates_are_not_restricted(self):
        r = client_for(self.dev).post("/api/portfolio/items/", {"title": "Eski ish", "start_date": day(-400).isoformat(),
                                                                "end_date": day(-300).isoformat()}, format="json")
        self.assertIn(r.status_code, (200, 201), r.data)


@override_settings(DEBUG=True)
class SeedDemoStillWorksTests(TestCase):
    def test_seed_demo_creates_overdue_examples(self):
        call_command("seed_demo", stdout=StringIO())
        from apps.tasks.models import Task
        self.assertTrue(Task.objects.filter(due_at__lt=timezone.now()).exists())
