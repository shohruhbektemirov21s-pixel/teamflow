"""Ruxsatli fayl berish: production'da X-Accel-Redirect (Nginx), mahalliyda Django FileResponse."""
from django.core.files.base import ContentFile
from django.http import FileResponse
from django.test import TestCase, override_settings

from apps.accounts.models import Role
from apps.core.serving import protected_file
from apps.panel.tests.factories import client_for, make_user

ACCEL = override_settings(PROTECTED_MEDIA_ACCEL_PREFIX="/protected-media/")


class ProtectedFileTests(TestCase):
    def setUp(self):
        self.user = make_user(Role.DEVELOPER)
        self.user.avatar.save("men.jpg", ContentFile(b"\xff\xd8rasm"), save=True)
        self.file = self.user.avatar

    @ACCEL
    def test_accel_returns_internal_redirect_without_body(self):
        response = protected_file(self.file, content_type="image/jpeg", cache_control="private, max-age=86400")
        self.assertEqual(response["X-Accel-Redirect"], f"/protected-media/{self.file.name}")
        self.assertEqual(response.content, b"")
        self.assertEqual(response["Content-Type"], "image/jpeg")
        self.assertEqual(response["Cache-Control"], "private, max-age=86400")
        self.assertEqual(response["X-Content-Type-Options"], "nosniff")
        self.assertNotIn("Content-Disposition", response)

    @ACCEL
    def test_accel_keeps_original_name_for_download(self):
        response = protected_file(self.file, content_type="application/pdf", filename="Hisobot №1.pdf",
                                  as_attachment=True)
        self.assertTrue(response["Content-Disposition"].startswith("attachment;"))
        self.assertIn("filename*=utf-8''Hisobot%20%E2%84%961.pdf", response["Content-Disposition"])
        self.assertEqual(response["Cache-Control"], "no-store")

    @ACCEL
    def test_accel_missing_file_raises(self):
        self.file.storage.delete(self.file.name)
        with self.assertRaises(FileNotFoundError):
            protected_file(self.file, content_type="image/jpeg")

    def test_local_mode_streams_through_django(self):
        response = protected_file(self.file, content_type="image/jpeg")
        self.assertIsInstance(response, FileResponse)
        self.assertNotIn("X-Accel-Redirect", response)
        self.assertNotIn("Content-Disposition", response)  # ichki tasodifiy nom chiqmaydi
        self.assertEqual(b"".join(response.streaming_content), b"\xff\xd8rasm")
        response.close()

    @ACCEL
    def test_avatar_endpoint_checks_access_then_hands_off_to_nginx(self):
        url = f"/api/avatars/{self.user.pk}/"
        response = client_for(make_user(Role.DEPARTMENT)).get(url)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["X-Accel-Redirect"], f"/protected-media/{self.file.name}")
        self.assertEqual(response["Cache-Control"], "private, max-age=86400")
        self.file.storage.delete(self.file.name)
        self.assertEqual(client_for(self.user).get(url).status_code, 404)
