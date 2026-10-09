import tempfile
from pathlib import Path

from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.panel.tests.factories import make_user

LOGIN = "/api/auth/login/"


class LoginThrottleTests(TestCase):
    """Login cheklovi: IP (20/min) va login (30/soat). Hisoblagich keshda — har test toza boshlanadi."""

    def setUp(self):
        cache.clear()
        self.c = APIClient()

    def post(self, username, **extra):
        return self.c.post(LOGIN, {"username": username, "password": "notogri"}, format="json", **extra)

    def test_spoofed_forwarded_for_does_not_reset_ip_limit(self):
        codes = [self.post(f"u{i}", HTTP_X_FORWARDED_FOR=f"10.0.0.{i}").status_code for i in range(21)]
        self.assertNotIn(429, codes[:20])
        self.assertEqual(codes[20], 429)

    def test_same_username_limited_across_ips(self):
        codes = [self.post("ali", REMOTE_ADDR=f"10.1.{i // 250}.{i % 250}").status_code for i in range(31)]
        self.assertNotIn(429, codes[:30])
        self.assertEqual(codes[30], 429)
        # Boshqa login shu IP'lardan cheklanmaydi
        self.assertEqual(self.post("vali", REMOTE_ADDR="10.9.9.9").status_code, 400)

    def test_logged_in_user_is_also_limited(self):
        self.c.force_login(make_user("developer", username="jasur"))
        codes = [self.post(f"u{i}").status_code for i in range(21)]
        self.assertEqual(codes[20], 429)

    def test_admin_login_is_limited(self):
        codes = [
            self.client.post("/admin/login/", {"username": f"u{i}", "password": "notogri"}).status_code
            for i in range(21)
        ]
        self.assertNotIn(429, codes[:20])
        self.assertEqual(codes[20], 429)

    def test_admin_login_page_still_renders(self):
        self.assertEqual(self.client.get("/admin/login/").status_code, 200)


class SpaSecurityHeaderTests(TestCase):
    def test_index_has_content_security_policy(self):
        with tempfile.TemporaryDirectory() as dist:
            Path(dist, "index.html").write_text("<!doctype html><div id=root></div>", encoding="utf-8")
            with override_settings(FRONTEND_DIST=Path(dist)):
                response = self.client.get("/loyihalar")
                csp = response["Content-Security-Policy"]
                response.close()
        self.assertIn("script-src 'self'", csp)
        self.assertIn("object-src blob:", csp)
        self.assertNotIn("script-src 'self' 'unsafe-inline'", csp)
        self.assertNotIn("unsafe-eval", csp)
