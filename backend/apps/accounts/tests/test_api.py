from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import Role, User
from apps.panel.tests.factories import client_for, make_user, specialty


class RegisterLoginTests(TestCase):
    def setUp(self):
        cache.clear()  # throttle hisoblagichi
        self.c = APIClient()
        self.spec = specialty()

    def payload(self, **kw):
        data = {"first_name": "Ali", "last_name": "Valiyev", "specialty": self.spec.pk, "role": "developer",
                "username": "ali", "password": "Kuchli-parol-2026"}
        data.update(kw)
        return data

    def test_register_creates_inactive_user(self):
        r = self.c.post("/api/auth/register/", self.payload(), format="json")
        self.assertEqual(r.status_code, 201)
        user = User.objects.get(username="ali")
        self.assertFalse(user.is_active)
        self.assertEqual(user.role, Role.DEVELOPER)

    def test_cannot_register_as_boss(self):
        r = self.c.post("/api/auth/register/", self.payload(role="boss"), format="json")
        self.assertEqual(r.status_code, 400)
        self.assertFalse(User.objects.filter(username="ali").exists())

    def test_department_requires_name(self):
        r = self.c.post("/api/auth/register/", self.payload(role="department"), format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("department_name", r.data["fields"])
        r = self.c.post("/api/auth/register/", self.payload(role="department", department_name="IT boshqarmasi"),
                        format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(User.objects.get(username="ali").department_name, "IT boshqarmasi")

    def test_department_name_dropped_for_other_roles(self):
        self.c.post("/api/auth/register/", self.payload(department_name="X"), format="json")
        self.assertEqual(User.objects.get(username="ali").department_name, "")

    def test_duplicate_username(self):
        make_user(Role.PM, username="ali")
        r = self.c.post("/api/auth/register/", self.payload(), format="json")
        self.assertEqual(r.status_code, 400)

    def test_weak_password_rejected(self):
        r = self.c.post("/api/auth/register/", self.payload(password="123"), format="json")
        self.assertEqual(r.status_code, 400)
        self.assertIn("password", r.data["fields"])

    def test_login_pending_user_gets_clear_message(self):
        self.c.post("/api/auth/register/", self.payload(), format="json")
        r = self.c.post("/api/auth/login/", {"username": "ali", "password": "Kuchli-parol-2026"}, format="json")
        self.assertEqual(r.status_code, 403)
        self.assertEqual(r.data["code"], "not_approved")

    def test_login_pending_user_wrong_password_is_generic(self):
        self.c.post("/api/auth/register/", self.payload(), format="json")
        r = self.c.post("/api/auth/login/", {"username": "ali", "password": "notogri"}, format="json")
        self.assertEqual(r.status_code, 400)
        self.assertNotIn("code", r.data)

    def test_login_after_approval(self):
        self.c.post("/api/auth/register/", self.payload(), format="json")
        User.objects.filter(username="ali").update(is_active=True)
        r = self.c.post("/api/auth/login/", {"username": "ali", "password": "Kuchli-parol-2026"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["role"], "developer")
        self.assertEqual(self.c.get("/api/auth/me/").data["username"], "ali")

    def test_user_without_role_cannot_login(self):
        User.objects.create_superuser("admin", password="Admin-parol-2026")
        r = self.c.post("/api/auth/login/", {"username": "admin", "password": "Admin-parol-2026"}, format="json")
        self.assertEqual(r.status_code, 403)

    def test_unauthenticated_gets_401(self):
        self.assertEqual(self.c.get("/api/auth/me/").status_code, 401)
        self.assertEqual(self.c.get("/api/tasks/").status_code, 401)


class DevelopersListTests(TestCase):
    def test_only_managers(self):
        make_user(Role.DEVELOPER)
        make_user(Role.DEVELOPER, active=False)
        self.assertEqual(client_for(make_user(Role.DEVELOPER)).get("/api/developers/").status_code, 403)
        r = client_for(make_user(Role.PM)).get("/api/developers/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(len(r.data), 2)  # faqat faol dasturchilar (so'rovchi dasturchi ham)


class ProfileTests(TestCase):
    def test_update_saves_normalized_telegram_and_unlinks_old_chat(self):
        user = make_user(Role.DEVELOPER, telegram_username="@eski", telegram_chat_id="42")
        r = client_for(user).patch("/api/auth/profile/", {"first_name": "Yangi", "telegram_username": " yangi_tg "},
                                   format="json")
        self.assertEqual(r.status_code, 200)
        user.refresh_from_db()
        self.assertEqual(user.first_name, "Yangi")
        self.assertEqual(user.telegram_username, "@yangi_tg")
        self.assertEqual(user.telegram_chat_id, "")  # yangi username — botga /start qayta yuboriladi

    def test_same_telegram_keeps_linked_chat(self):
        user = make_user(Role.DEVELOPER, telegram_username="@ali", telegram_chat_id="42")
        client_for(user).patch("/api/auth/profile/", {"telegram_username": "ali"}, format="json")
        user.refresh_from_db()
        self.assertEqual(user.telegram_chat_id, "42")
