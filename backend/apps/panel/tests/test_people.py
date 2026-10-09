from datetime import timedelta

from django.test import TestCase
from django.utils import timezone

from apps.accounts.models import Role
from apps.panel.tests.factories import client_for, make_project, make_task, make_user
from apps.panel.api import _people_rows
from apps.accounts.models import User
from apps.tasks.models import Task


class PeopleWorkTests(TestCase):
    def setUp(self):
        self.boss = make_user(Role.BOSS)
        self.pm = make_user(Role.PM)
        self.dev = make_user(Role.DEVELOPER)
        self.other = make_user(Role.DEVELOPER)
        self.project = make_project(self.pm, self.dev, name="Portal")

    def test_both_managers_see_assigned_work_and_projects(self):
        due = timezone.now() - timedelta(days=1)
        task = make_task(self.project, self.pm, self.dev, status=Task.Status.CONTROL, due_at=due)
        review = make_task(self.project, self.pm, self.dev, status=Task.Status.IN_REVIEW)
        make_task(self.project, self.pm, self.dev, status=Task.Status.DONE)
        make_task(self.project, self.pm, self.dev, archived_at=timezone.now())
        make_task(self.project, self.pm, self.other, title="Boshqa xodim ishi")
        for manager in (self.boss, self.pm):
            response = client_for(manager).get(f"/api/people/{self.dev.pk}/")
            self.assertEqual(response.status_code, 200)
            row = response.data
            self.assertEqual(row["active_tasks"], 2)
            self.assertEqual({t["id"] for t in row["work"]}, {task.pk, review.pk})
            overdue = next(t for t in row["work"] if t["id"] == task.pk)
            self.assertTrue(overdue["is_overdue"])
            self.assertEqual(overdue["project"]["id"], self.project.pk)
            self.assertEqual([p["id"] for p in row["projects"]], [self.project.pk])
            rows = client_for(manager).get("/api/people/").data
            self.assertEqual(next(p for p in rows if p["id"] == self.dev.pk)["work"], row["work"])

    def test_pm_profile_shows_managed_project_without_tasks(self):
        row = client_for(self.boss).get(f"/api/people/{self.pm.pk}/").data
        self.assertEqual(row["work"], [])
        self.assertEqual([p["id"] for p in row["projects"]], [self.project.pk])

    def test_work_preview_is_bounded_but_counts_include_all_work(self):
        for i in range(5):
            make_task(self.project, self.pm, self.dev, title=f"Vazifa {i}")
        row = client_for(self.pm).get(f"/api/people/{self.dev.pk}/").data
        self.assertEqual(len(row["work"]), 3)
        self.assertEqual(row["active_tasks"], 5)

    def test_permissions_remain_enforced(self):
        for actor in (self.dev, make_user(Role.DEPARTMENT)):
            for path in ("/api/people/", f"/api/people/{self.dev.pk}/"):
                self.assertEqual(client_for(actor).get(path).status_code, 403)
        self.assertEqual(client_for(self.pm).get(f"/api/people/{self.boss.pk}/").status_code, 404)
        self.dev.is_active = False
        self.dev.save(update_fields=["is_active"])
        self.assertEqual(client_for(self.boss).get(f"/api/people/{self.dev.pk}/").status_code, 404)

    def test_queries_do_not_grow_per_employee(self):
        make_task(self.project, self.pm, self.dev, self.other)
        with self.assertNumQueries(5):
            rows = _people_rows(User.objects.filter(pk__in=[self.dev.pk, self.other.pk, self.pm.pk]))
        self.assertEqual(len(rows), 3)


class PeopleDueRangeTests(TestCase):
    """Xodimlar sahifasidagi "Sanadan — Sanagacha" filtri: oraliqda muddati bo'lgan har qanday holatdagi
    (bajarilgan ham) vazifasi bor xodimlar chiqadi; arxivlangan vazifa hisobga olinmaydi."""

    def setUp(self):
        self.boss = make_user(Role.BOSS)
        self.pm = make_user(Role.PM)
        self.dev = make_user(Role.DEVELOPER)
        self.other = make_user(Role.DEVELOPER)
        self.idle = make_user(Role.DEVELOPER)
        self.project = make_project(self.pm, self.dev, self.other, name="Portal")
        self.day = timezone.localdate() + timedelta(days=10)
        noon = timezone.make_aware(timezone.datetime.combine(self.day, timezone.datetime.min.time())) + timedelta(hours=12)
        self.done = make_task(self.project, self.pm, self.dev, title="Bajarilgan", status=Task.Status.DONE, due_at=noon)
        self.active = make_task(self.project, self.pm, self.dev, title="Faol", due_at=noon + timedelta(days=1))
        make_task(self.project, self.pm, self.other, title="Arxiv", due_at=noon, archived_at=timezone.now())
        make_task(self.project, self.pm, self.other, title="Keyinroq", due_at=noon + timedelta(days=30))

    def ids(self, user=None, **params):
        response = client_for(user or self.pm).get("/api/people/", {"paginated": 1, **params})
        self.assertEqual(response.status_code, 200, response.data)
        return {row["id"]: row for row in response.data["results"]}

    def test_range_includes_done_tasks_and_excludes_archived(self):
        rows = self.ids(due_from=self.day.isoformat(), due_to=self.day.isoformat())
        self.assertEqual(set(rows), {self.dev.pk})
        self.assertEqual(rows[self.dev.pk]["range_tasks"], 1)
        self.assertEqual([t["id"] for t in rows[self.dev.pk]["work"]], [self.done.pk])
        self.assertFalse(rows[self.dev.pk]["work"][0]["is_overdue"])  # bajarilgan ish "kechikkan" emas

    def test_both_boundary_days_are_included(self):
        rows = self.ids(due_from=self.day.isoformat(), due_to=(self.day + timedelta(days=1)).isoformat())
        self.assertEqual(rows[self.dev.pk]["range_tasks"], 2)
        self.assertEqual({t["id"] for t in rows[self.dev.pk]["work"]}, {self.done.pk, self.active.pk})

    def test_open_ended_ranges(self):
        later = (self.day + timedelta(days=2)).isoformat()
        self.assertEqual(set(self.ids(due_from=later)), {self.other.pk})
        self.assertEqual(set(self.ids(due_to=self.day.isoformat())), {self.dev.pk})

    def test_without_range_nothing_changes(self):
        rows = self.ids()
        self.assertEqual(set(rows), {self.dev.pk, self.other.pk, self.idle.pk})
        self.assertIsNone(rows[self.dev.pk]["range_tasks"])
        self.assertEqual([t["id"] for t in rows[self.dev.pk]["work"]], [self.active.pk])

    def test_reversed_range_is_rejected(self):
        response = client_for(self.pm).get("/api/people/", {
            "due_from": self.day.isoformat(), "due_to": (self.day - timedelta(days=1)).isoformat()})
        self.assertEqual(response.status_code, 400)
        self.assertIn("due_to", response.data["fields"])

    def test_role_limits_still_apply_with_range(self):
        make_task(self.project, self.pm, self.dev, due_at=self.done.due_at)
        rows = self.ids(self.boss, due_from=self.day.isoformat(), due_to=self.day.isoformat())
        self.assertEqual(set(rows), {self.dev.pk})
        for actor in (self.dev, make_user(Role.DEPARTMENT)):
            self.assertEqual(client_for(actor).get("/api/people/", {"due_from": self.day.isoformat()}).status_code, 403)

    def test_done_task_in_past_range_is_not_marked_overdue(self):
        past = timezone.now() - timedelta(days=3)
        task = make_task(self.project, self.pm, self.other, status=Task.Status.DONE, due_at=past)
        day = timezone.localdate(past).isoformat()
        rows = self.ids(due_from=day, due_to=day)
        self.assertEqual([t["id"] for t in rows[self.other.pk]["work"]], [task.pk])
        self.assertFalse(rows[self.other.pk]["work"][0]["is_overdue"])
