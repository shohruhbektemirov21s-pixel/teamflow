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

    def test_pm_person_detail_uses_same_scope_as_people_list(self):
        pm = make_user(Role.PM)
        boss = make_user(Role.BOSS)
        dev = make_user(Role.DEVELOPER)
        self.assertEqual(client_for(pm).get(f"/api/people/{boss.pk}/").status_code, 404)
        self.assertEqual(client_for(pm).get(f"/api/people/{dev.pk}/").status_code, 200)
        self.assertEqual(client_for(boss).get(f"/api/people/{pm.pk}/").status_code, 200)


class ProfileBioAndPortfolioTests(TestCase):
    def test_bio_is_saved_trimmed_and_limited(self):
        user = make_user(Role.USER)
        api = client_for(user)
        ok = api.patch("/api/auth/profile/", {"bio": "  Dizayn yoqtiraman  "}, format="json")
        self.assertEqual((ok.status_code, ok.data["bio"]), (200, "Dizayn yoqtiraman"))
        self.assertEqual(api.patch("/api/auth/profile/", {"bio": "x" * 301}, format="json").status_code, 400)
        self.assertEqual(api.patch("/api/auth/profile/", {"first_name": ""}, format="json").status_code, 400)
        self.assertEqual(api.patch("/api/auth/profile/", {"role": "boss"}, format="json").status_code, 200)
        user.refresh_from_db()
        self.assertEqual(user.role, Role.USER)
        self.assertEqual(api.get("/api/auth/profile/").data["bio"], "Dizayn yoqtiraman")

    def test_portfolio_summary_only_for_developers(self):
        from apps.portfolio.models import PortfolioItem
        dev = make_user(Role.DEVELOPER)
        PortfolioItem.objects.create(owner=dev, title="Sayt", technologies=["Django", "React"])
        data = client_for(dev).get("/api/auth/profile/").data["portfolio"]
        self.assertEqual((data["rating"], data["reviews_count"], data["projects_count"]), (None, 0, 1))
        self.assertEqual(sorted(data["technologies"]), ["Django", "React"])
        self.assertIsNone(client_for(make_user(Role.USER)).get("/api/auth/profile/").data["portfolio"])

    def test_email_is_validated_and_security_fields_are_exposed(self):
        user = make_user(Role.DEVELOPER)
        api = client_for(user)
        self.assertEqual(api.patch("/api/auth/profile/", {"email": "bu-email-emas"}, format="json").status_code, 400)
        ok = api.patch("/api/auth/profile/", {"email": " Ali@Example.com "}, format="json")
        self.assertEqual((ok.status_code, ok.data["email"]), (200, "Ali@Example.com"))
        self.assertEqual(api.patch("/api/auth/profile/", {"email": ""}, format="json").data["email"], "")
        data = api.get("/api/auth/profile/").data
        self.assertIs(data["telegram_connected"], False)
        self.assertIn("last_login", data)
        self.assertNotIn("password", data)
        user.telegram_chat_id = "123"
        user.save(update_fields=["telegram_chat_id"])
        self.assertIs(api.get("/api/auth/profile/").data["telegram_connected"], True)
