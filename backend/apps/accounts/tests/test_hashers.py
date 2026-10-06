from django.contrib.auth.hashers import make_password
from django.core.cache import cache
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from apps.accounts.models import Role, User

HASHERS = [
    "apps.accounts.hashers.Argon2idHasher",
    "django.contrib.auth.hashers.PBKDF2PasswordHasher",
]


@override_settings(PASSWORD_HASHERS=HASHERS)
class Argon2idHasherTests(TestCase):
    def setUp(self):
        cache.clear()  # throttle hisoblagichi
        self.addCleanup(cache.clear)

    def test_new_password_uses_argon2id_with_owasp_parameters(self):
        encoded = make_password("Parol-12345")
        self.assertTrue(encoded.startswith("argon2$argon2id$v=19$m=19456,t=2,p=1$"), encoded)

    def test_legacy_pbkdf2_password_still_works_and_is_upgraded_on_login(self):
        user = User.objects.create(
            username="eski", role=Role.DEVELOPER, password=make_password("Parol-12345", hasher="pbkdf2_sha256")
        )
        response = APIClient().post("/api/auth/login/", {"username": "eski", "password": "Parol-12345"}, format="json")
        self.assertEqual(response.status_code, 200)
        user.refresh_from_db()
        self.assertTrue(user.password.startswith("argon2$argon2id$"), user.password[:30])
        self.assertTrue(user.check_password("Parol-12345"))

    def test_wrong_password_does_not_upgrade_hash(self):
        legacy = make_password("Parol-12345", hasher="pbkdf2_sha256")
        user = User.objects.create(username="eski2", role=Role.DEVELOPER, password=legacy)
        response = APIClient().post("/api/auth/login/", {"username": "eski2", "password": "boshqa"}, format="json")
        self.assertEqual(response.status_code, 400)
        user.refresh_from_db()
        self.assertEqual(user.password, legacy)
