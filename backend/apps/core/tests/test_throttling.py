from types import SimpleNamespace
from unittest import mock

from django.contrib.auth.models import AnonymousUser
from django.core.cache import cache
from django.test import SimpleTestCase, TestCase
from rest_framework.test import APIClient

from apps.accounts.models import Role
from apps.core.throttling import LoginThrottle, UserThrottle
from apps.panel.tests.factories import make_user


class UserThrottleTests(SimpleTestCase):
    def test_key_is_user_id_and_anonymous_is_not_limited(self):
        throttle = UserThrottle()
        user = SimpleNamespace(pk=5, is_authenticated=True)
        self.assertEqual(throttle.get_cache_key(SimpleNamespace(user=user), None), "throttle_user_5")
        # Anonim so'rov (login sahifasi) IP bo'yicha cheklanmaydi — NAT ortidagi ofis bloklanmasin
        self.assertIsNone(throttle.get_cache_key(SimpleNamespace(user=AnonymousUser()), None))


@mock.patch.dict(LoginThrottle.THROTTLE_RATES, {"login": "2/min", "login_failures_ip": "3/hour"})
class LoginThrottleTests(TestCase):
    def setUp(self):
        cache.clear()
        self.addCleanup(cache.clear)
        self.user = make_user(Role.DEVELOPER)
        self.client = APIClient()

    def _login(self, username, password="noto'g'ri"):
        return self.client.post("/api/auth/login/", {"username": username, "password": password}, format="json")

    def test_limit_is_per_username_not_per_ip(self):
        for _ in range(2):
            self.assertEqual(self._login(self.user.username).status_code, 400)
        self.assertEqual(self._login(self.user.username).status_code, 429)
        # Xuddi shu IP'dan boshqa xodim bemalol kiradi
        other = make_user(Role.DEVELOPER)
        self.assertEqual(self._login(other.username, "Parol-12345").status_code, 200)

    def test_username_case_and_spaces_do_not_bypass_the_limit(self):
        for name in (self.user.username, f"  {self.user.username.upper()} "):
            self._login(name)
        self.assertEqual(self._login(self.user.username).status_code, 429)

    def test_successful_logins_from_one_ip_are_not_limited(self):
        # NAT ortidagi ofis: bitta IP'dan ko'p xodim to'g'ri parol bilan kiradi
        for _ in range(6):
            user = make_user(Role.DEVELOPER)
            self.assertEqual(self._login(user.username, "Parol-12345").status_code, 200)

    def test_failed_logins_across_usernames_block_the_ip(self):
        # Password spraying: bitta IP, har xil login nomlari, bitta parol
        for n in range(3):
            self.assertEqual(self._login(f"yoq{n}").status_code, 400)
        self.assertEqual(self._login("yoq-boshqa").status_code, 429)
        self.assertEqual(self._login(self.user.username, "Parol-12345").status_code, 429)
