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


class PeopleStateSortSummaryTests(TestCase):
    """Xodimlar sahifasi: Barchasi / Faol / Bo'sh chiplari, saralash va yuklama sonlari."""

    def setUp(self):
        self.pm = make_user(Role.PM)
        self.busy = make_user(Role.DEVELOPER, first_name="Bobur")
        self.late = make_user(Role.DEVELOPER, first_name="Anvar")
        self.idle = make_user(Role.DEVELOPER, first_name="Zafar")
        self.away = make_user(Role.DEVELOPER, first_name="Karim")
        self.away.business_trip_return_date = timezone.localdate() + timedelta(days=3)
        self.away.save(update_fields=["business_trip_return_date"])
        self.project = make_project(self.pm, self.busy, self.late, self.idle, self.away, name="Portal")
        make_task(self.project, self.pm, self.busy, priority="high")
        make_task(self.project, self.pm, self.busy, priority="urgent")
        make_task(self.project, self.pm, self.busy, priority="low", status=Task.Status.DONE)
        make_task(self.project, self.pm, self.busy, priority="urgent", archived_at=timezone.now())
        make_task(self.project, self.pm, self.late, due_at=timezone.now() - timedelta(days=2))

    def get(self, **params):
        response = client_for(self.pm).get("/api/people/", {"paginated": 1, **params})
        self.assertEqual(response.status_code, 200, response.data)
        return response.data

    def first_names(self, **params):
        return [row["full_name"].split()[0] for row in self.get(**params)["results"]]

    def test_rows_carry_total_and_high_priority_counts(self):
        row = next(r for r in self.get()["results"] if r["id"] == self.busy.pk)
        self.assertEqual(row["total_tasks"], 3)  # arxivlangani hisobga olinmaydi
        self.assertEqual(row["active_tasks"], 2)
        self.assertEqual(row["high_tasks"], 2)  # faqat faol, Yuqori va Shoshilinch
        work = row["work"][0]
        self.assertEqual(len(work["code"]), 9)
        self.assertIn(work["priority"], {"high", "urgent"})

    def test_summary_counts_ignore_the_state_filter(self):
        expected = {"all": 4, "active": 2, "free": 1}  # Karim safarda: bo'sh emas
        self.assertEqual(self.get()["summary"], expected)
        self.assertEqual(self.get(state="active")["summary"], expected)
        self.assertEqual(self.get(state="free")["summary"], expected)

    def test_state_filter(self):
        active = self.get(state="active")
        self.assertEqual({r["id"] for r in active["results"]}, {self.busy.pk, self.late.pk})
        self.assertEqual(active["count"], 2)
        self.assertEqual({r["id"] for r in self.get(state="free")["results"]}, {self.idle.pk})

    def test_summary_follows_search(self):
        self.assertEqual(self.get(q="Bobur")["summary"], {"all": 1, "active": 1, "free": 0})

    def test_sorting(self):
        self.assertEqual(self.first_names(), ["Anvar", "Bobur", "Karim", "Zafar"])  # standart — ism bo'yicha
        self.assertEqual(self.first_names(sort="overdue")[0], "Anvar")
        self.assertIn(self.first_names(sort="free")[0], {"Karim", "Zafar"})
        self.assertEqual(self.first_names(sort="nomalum"), self.first_names())

    def test_unpaginated_list_has_no_summary_and_keeps_the_array_shape(self):
        response = client_for(self.pm).get("/api/people/")
        self.assertIsInstance(response.data, list)
