"""Profil: Telegram username takrorlanmaydi, "Muddati o'tgan" bosh panel bilan bir xil hisoblanadi."""
from datetime import timedelta

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import Role
from apps.panel.tests.factories import client_for, make_project, make_task, make_user, specialty
from apps.tasks.models import Task


class TelegramUniqueTests(TestCase):
    def setUp(self):
        self.owner = make_user(Role.DEVELOPER, telegram_username="@jasur_tg")

    def test_register_rejects_taken_username_case_insensitive(self):
        r = APIClient().post("/api/auth/register/", {
            "first_name": "Ali", "last_name": "Valiyev", "specialty": specialty().pk, "role": "developer",
            "username": "ali", "password": "Juda-kuchli-parol-7", "telegram_username": "JASUR_TG",
        }, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("telegram_username", r.data["fields"])

    def test_profile_rejects_taken_but_allows_own(self):
        other = client_for(make_user(Role.DEVELOPER))
        self.assertEqual(other.patch("/api/auth/profile/", {"telegram_username": "@jasur_tg"}, format="json").status_code, 400)
        mine = client_for(self.owner).patch("/api/auth/profile/", {"telegram_username": "jasur_tg"}, format="json")
        self.assertEqual(mine.status_code, 200)

    def test_lone_at_sign_is_empty(self):
        user = make_user(Role.DEVELOPER)
        r = client_for(user).patch("/api/auth/profile/", {"telegram_username": "@"}, format="json")
        self.assertEqual(r.data["telegram_username"], "")


class ProfileOverdueTests(TestCase):
    def test_overdue_includes_tasks_in_review(self):
        pm, dev = make_user(Role.PM), make_user(Role.DEVELOPER)
        project = make_project(pm, dev)
        past = timezone.now() - timedelta(days=1)
        make_task(project, pm, dev, status=Task.Status.IN_REVIEW, due_at=past)
        make_task(project, pm, dev, status=Task.Status.IN_PROGRESS, due_at=past)

        profile = client_for(dev).get("/api/auth/profile/").data["stats"]
        dashboard = client_for(dev).get("/api/dashboard/").data["totals"]

        self.assertEqual(profile["overdue"], 2)
        self.assertEqual(profile["overdue"], dashboard["overdue"])


class MyTasksTests(TestCase):
    def test_mine_returns_only_own_assigned_tasks(self):
        from apps.tasks.models import SubTask
        pm, dev, other = make_user(Role.PM), make_user(Role.DEVELOPER), make_user(Role.DEVELOPER)
        project = make_project(pm, dev, other)
        own = make_task(project, pm, dev, title="Meniki")
        foreign = make_task(project, pm, other, title="Begona")
        SubTask.objects.create(task=foreign, title="Qadam").assignees.add(dev)  # sub-vazifa — vazifa uniki emas

        titles = [t["title"] for t in client_for(dev).get("/api/tasks/", {"mine": 1, "all": 1}).data]

        self.assertEqual(titles, [own.title])


class ProfileMatchesPersonTests(TestCase):
    def test_profile_stats_equal_person_row(self):
        pm, dev = make_user(Role.PM), make_user(Role.DEVELOPER)
        project = make_project(pm, dev)
        for status in (Task.Status.CONTROL, Task.Status.IN_PROGRESS, Task.Status.IN_REVIEW, Task.Status.DONE):
            make_task(project, pm, dev, status=status)

        stats = client_for(dev).get("/api/auth/profile/").data["stats"]
        row = client_for(pm).get(f"/api/people/{dev.pk}/").data

        self.assertEqual(
            (stats["active"], stats["overdue"], stats["in_review"], stats["done"]),
            (row["active_tasks"], row["overdue_tasks"], row["review_tasks"], row["done_tasks"]),
        )
