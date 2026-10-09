from django.test import TestCase

from apps.accounts.models import Role
from apps.panel.tests.factories import client_for, make_user


class TechnologiesTests(TestCase):
    def setUp(self):
        self.dev = make_user(Role.DEVELOPER)
        self.url = "/api/auth/technologies/"

    def test_developer_can_set_and_edit_own_technologies(self):
        client = client_for(self.dev)
        r = client.patch(self.url, {"technologies": "React, Django, PostgreSQL"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.dev.refresh_from_db()
        self.assertEqual(self.dev.technologies, "React, Django, PostgreSQL")
        r = client.patch(self.url, {"technologies": "Go"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.dev.refresh_from_db()
        self.assertEqual(self.dev.technologies, "Go")

    def test_non_developer_cannot_set_technologies(self):
        for role in (Role.PM, Role.BOSS, Role.DEPARTMENT, Role.USER):
            r = client_for(make_user(role)).patch(self.url, {"technologies": "Python"}, format="json")
            self.assertEqual(r.status_code, 403, role)

    def test_blank_clears_technologies(self):
        client = client_for(self.dev)
        client.patch(self.url, {"technologies": "Python"}, format="json")
        r = client.patch(self.url, {"technologies": ""}, format="json")
        self.assertEqual(r.status_code, 200)
        self.dev.refresh_from_db()
        self.assertEqual(self.dev.technologies, "")

    def test_too_long_rejected(self):
        r = client_for(self.dev).patch(self.url, {"technologies": "x" * 301}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_anonymous_gets_401(self):
        from rest_framework.test import APIClient
        self.assertEqual(APIClient().patch(self.url, {"technologies": "Python"}, format="json").status_code, 401)

    def test_technologies_appear_in_portfolio_search(self):
        self.dev.technologies = "Elixir, Phoenix"
        self.dev.save(update_fields=["technologies"])
        r = client_for(make_user(Role.PM)).get("/api/portfolio/", {"q": "Elixir"})
        self.assertEqual(r.data["count"], 1)
        self.assertEqual(r.data["results"][0]["id"], self.dev.pk)
