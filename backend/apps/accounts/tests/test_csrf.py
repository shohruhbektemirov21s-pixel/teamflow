from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import Role
from apps.panel.tests.factories import make_user


class LoginCSRFTests(TestCase):
    def test_login_requires_csrf_even_before_authentication(self):
        user = make_user(Role.DEVELOPER)
        client = APIClient(enforce_csrf_checks=True)
        payload = {"username": user.username, "password": "Parol-12345"}
        self.assertEqual(client.post("/api/auth/login/", payload, format="json").status_code, 403)
        client.get("/api/auth/csrf/")
        token = client.cookies["csrftoken"].value
        self.assertEqual(client.post("/api/auth/login/", payload, format="json", HTTP_X_CSRFTOKEN=token).status_code, 200)

