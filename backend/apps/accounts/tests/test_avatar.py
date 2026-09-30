"""Profil rasmi: faqat haqiqiy rasm, kichraytiriladi, faqat kirganlarga beriladi."""
import io

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from PIL import Image
from rest_framework.test import APIClient

from apps.accounts.models import Role
from apps.panel.tests.factories import client_for, make_project, make_task, make_user


def image_file(name="men.png", size=(1600, 1200), fmt="PNG", mode="RGBA"):
    buffer = io.BytesIO()
    Image.new(mode, size, (200, 30, 30, 255) if mode == "RGBA" else (200, 30, 30)).save(buffer, fmt)
    return SimpleUploadedFile(name, buffer.getvalue(), content_type=f"image/{fmt.lower()}")


class AvatarTests(TestCase):
    def setUp(self):
        self.dev = make_user(Role.DEVELOPER)
        self.client_dev = client_for(self.dev)

    def upload(self, f):
        return self.client_dev.post("/api/auth/avatar/", {"avatar": f}, format="multipart")

    def test_upload_resizes_and_shows_everywhere(self):
        r = self.upload(image_file())
        self.assertEqual(r.status_code, 200, r.data)
        url = r.data["avatar"]
        self.assertTrue(url.startswith(f"/api/avatars/{self.dev.pk}/?v="))
        self.dev.refresh_from_db()
        with Image.open(self.dev.avatar.path) as saved:
            self.assertEqual(saved.format, "JPEG")
            self.assertEqual(max(saved.size), 1024)
        # joriy foydalanuvchi va vazifa ijrochilari (user_brief) orqali ham keladi
        self.assertEqual(self.client_dev.get("/api/auth/me/").data["avatar"], url)
        pm = make_user(Role.PM)
        task = make_task(make_project(pm, self.dev), pm, self.dev)
        self.assertEqual(client_for(pm).get(f"/api/tasks/{task.pk}/").data["assignees"][0]["avatar"], url)

    def test_rejects_non_image_and_big_files(self):
        fake = SimpleUploadedFile("rasm.png", b"bu rasm emas", content_type="image/png")
        self.assertEqual(self.upload(fake).status_code, 400)
        big = SimpleUploadedFile("katta.png", b"0" * (5 * 1024 * 1024 + 1), content_type="image/png")
        self.assertEqual(self.upload(big).status_code, 400)
        self.assertEqual(self.upload(image_file("anim.gif", fmt="GIF", mode="RGB")).status_code, 400)
        self.dev.refresh_from_db()
        self.assertFalse(self.dev.avatar)

    def test_image_only_for_signed_in_users(self):
        self.upload(image_file("men.jpg", fmt="JPEG", mode="RGB"))
        url = f"/api/avatars/{self.dev.pk}/"
        self.assertIn(APIClient().get(url).status_code, (401, 403))
        r = client_for(make_user(Role.DEPARTMENT)).get(url)
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r["Content-Type"], "image/jpeg")
        self.assertEqual(client_for(self.dev).get(f"/api/avatars/{make_user(Role.PM).pk}/").status_code, 404)

    def test_replace_deletes_old_file_and_delete_removes(self):
        self.upload(image_file())
        self.dev.refresh_from_db()
        old = self.dev.avatar.name
        self.upload(image_file("yangi.png"))
        self.dev.refresh_from_db()
        self.assertNotEqual(self.dev.avatar.name, old)
        self.assertFalse(self.dev.avatar.storage.exists(old))

        r = self.client_dev.delete("/api/auth/avatar/")
        self.assertEqual(r.status_code, 200)
        self.assertIsNone(r.data["avatar"])
        self.dev.refresh_from_db()
        self.assertFalse(self.dev.avatar)
