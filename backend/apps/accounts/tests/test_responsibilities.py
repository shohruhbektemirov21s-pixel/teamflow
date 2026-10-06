from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import Role
from apps.core.models import ActivityLog
from apps.panel.tests.factories import client_for, make_user


class ResponsibilitiesTests(TestCase):
    def setUp(self):
        self.boss = make_user(Role.BOSS)
        self.pm = make_user(Role.PM)
        self.dev = make_user(Role.DEVELOPER)
        self.url = f"/api/people/{self.dev.pk}/responsibilities/"

    def test_boss_and_pm_can_set_edit_and_clear_responsibilities(self):
        for actor, text in [(self.boss, "  API va serverlarga mas'ul  "), (self.pm, "Backend\nMa'lumotlar bazasi"), (self.pm, "")]:
            response = client_for(actor).patch(self.url, {"responsibilities": text}, format="json")
            self.assertEqual(response.status_code, 200)
            self.dev.refresh_from_db()
            self.assertEqual(self.dev.responsibilities, text.strip())
            self.assertEqual(client_for(actor).get(f"/api/people/{self.dev.pk}/").data["responsibilities"], text.strip())
            rows = client_for(actor).get("/api/people/").data
            self.assertEqual(next(p for p in rows if p["id"] == self.dev.pk)["responsibilities"], text.strip())
        self.assertEqual(ActivityLog.objects.filter(verb="responsibilities_updated").count(), 3)

    def test_non_managers_cannot_edit(self):
        for actor in (self.dev, make_user(Role.DEPARTMENT)):
            self.assertEqual(client_for(actor).patch(self.url, {"responsibilities": "Changed"}, format="json").status_code, 403)
        self.assertIn(APIClient().patch(self.url, {"responsibilities": "Changed"}, format="json").status_code, [401, 403])
        self.dev.refresh_from_db()
        self.assertEqual(self.dev.responsibilities, "")

    def test_target_permissions_match_profile_access(self):
        pm_url = f"/api/people/{self.pm.pk}/responsibilities/"
        self.assertEqual(client_for(self.boss).patch(pm_url, {"responsibilities": "Loyihalar nazorati"}, format="json").status_code, 200)
        self.assertEqual(client_for(self.pm).patch(pm_url, {"responsibilities": "Changed"}, format="json").status_code, 404)
        self.dev.is_active = False
        self.dev.save(update_fields=["is_active"])
        self.assertEqual(client_for(self.boss).patch(self.url, {"responsibilities": "Changed"}, format="json").status_code, 404)

    def test_validation_and_unrelated_fields_are_protected(self):
        c = client_for(self.pm)
        for payload in ({}, {"responsibilities": None}, {"responsibilities": "x" * 2001}):
            self.assertEqual(c.patch(self.url, payload, format="json").status_code, 400)
        self.assertEqual(c.patch(self.url, {"responsibilities": "x" * 2000, "role": "boss", "is_active": False}, format="json").status_code, 200)
        self.dev.refresh_from_db()
        self.assertEqual(self.dev.role, Role.DEVELOPER)
        self.assertTrue(self.dev.is_active)
        self.assertEqual(len(self.dev.responsibilities), 2000)
