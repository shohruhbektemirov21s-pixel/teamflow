import io

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from PIL import Image

from apps.accounts.models import Role, Specialty, User
from apps.core.models import ActivityLog
from apps.panel.tests.factories import client_for, make_user

URL = "/api/people/new-developer/"


def png():
    buffer = io.BytesIO()
    Image.new("RGB", (40, 40), "red").save(buffer, "PNG")
    return SimpleUploadedFile("a.png", buffer.getvalue(), content_type="image/png")


class NewDeveloperTests(TestCase):
    def setUp(self):
        self.boss = make_user(Role.BOSS)
        self.specialty = Specialty.objects.create(name="Backend")
        self.payload = {"first_name": "Ali", "last_name": "Valiyev", "specialty": self.specialty.pk, "bio": "Django",
                        "technologies": ["Python", "python", "Django"], "username": "ali_dev", "password": "Yaxshi-Parol-2026"}

    def test_boss_adds_inactive_developer_until_admin_approves(self):
        response = client_for(self.boss).post(URL, {**self.payload, "avatar": png()}, format="multipart")
        self.assertEqual(response.status_code, 201, response.data)
        user = User.objects.get(username="ali_dev")
        self.assertFalse(user.is_active)
        self.assertEqual(user.role, Role.DEVELOPER)
        self.assertEqual(user.technologies, ["Python", "Django"])
        self.assertTrue(user.avatar)
        self.assertTrue(user.check_password("Yaxshi-Parol-2026"))
        self.assertTrue(ActivityLog.objects.filter(verb="developer_added").exists())
        self.assertFalse(any(p["id"] == user.pk for p in client_for(self.boss).get("/api/people/").data))
        self.assertFalse(self.client.login(username="ali_dev", password="Yaxshi-Parol-2026"))

    def test_only_boss_can_add(self):
        for actor in (make_user(Role.PM), make_user(Role.DEVELOPER), make_user(Role.DEPARTMENT), make_user(Role.USER)):
            self.assertEqual(client_for(actor).post(URL, self.payload, format="json").status_code, 403)
        self.assertFalse(User.objects.filter(username="ali_dev").exists())

    def test_validation(self):
        make_user(Role.PM, username="band")
        for patch, field in [({"username": "band"}, "username"), ({"password": "1234"}, "password"),
                             ({"first_name": ""}, "first_name"), ({"technologies": [f"t{i}" for i in range(11)]}, "technologies")]:
            response = client_for(self.boss).post(URL, {**self.payload, **patch}, format="json")
            self.assertEqual(response.status_code, 400, patch)

    def test_bad_image_creates_nothing(self):
        bad = SimpleUploadedFile("a.png", b"not an image", content_type="image/png")
        response = client_for(self.boss).post(URL, {**self.payload, "avatar": bad}, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(User.objects.filter(username="ali_dev").exists())

    def test_own_technologies_show_in_portfolio(self):
        client_for(self.boss).post(URL, self.payload, format="json")
        user = User.objects.get(username="ali_dev")
        user.is_active = True
        user.save()
        data = client_for(self.boss).get(f"/api/portfolio/{user.pk}/").data
        self.assertEqual([t["name"] for t in data["technologies"]], ["Django", "Python"])
