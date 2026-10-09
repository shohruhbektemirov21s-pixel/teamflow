"""Portfolio muqova rasmi: yuklash, almashtirish, o'chirish, ruxsat va fayl xavfsizligi."""
import io

from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image

from apps.panel.tests.factories import client_for

from ..models import PortfolioItem
from .test_api import PortfolioTestCase


def png(name="cover.png", size=(2000, 1000), exif=False):
    buffer = io.BytesIO()
    image = Image.new("RGBA", size, (200, 30, 30, 128))
    if exif:
        image = image.convert("RGB")
        data = Image.Exif()
        data[0x010F] = "Kamera"  # Make
        image.save(buffer, "JPEG", exif=data.tobytes())
        return SimpleUploadedFile(name.replace(".png", ".jpg"), buffer.getvalue(), content_type="image/jpeg")
    image.save(buffer, "PNG")
    return SimpleUploadedFile(name, buffer.getvalue(), content_type="image/png")


class CoverTests(PortfolioTestCase):
    def upload(self, user, item, file):
        return client_for(user).post(f"/api/portfolio/items/{item.pk}/cover/", {"cover": file})

    def test_owner_uploads_cover_seen_in_grid_and_served_as_jpeg(self):
        item = self.manual_item()
        res = self.upload(self.dev, item, png())
        self.assertEqual(res.status_code, 200)
        url = res.data["cover"]
        self.assertTrue(url.startswith(f"/api/portfolio/covers/{item.pk}/?v="))
        grid = client_for(self.dept).get(f"/api/portfolio/{self.dev.pk}/").data["items"]
        self.assertEqual(next(i for i in grid if i["id"] == item.pk)["cover"], url)

        image = client_for(self.dept).get(url)
        self.assertEqual(image.status_code, 200)
        self.assertEqual(image["Content-Type"], "image/jpeg")
        self.assertEqual(image["X-Content-Type-Options"], "nosniff")
        saved = Image.open(io.BytesIO(b"".join(image.streaming_content)))
        self.assertEqual(saved.format, "JPEG")
        self.assertEqual(max(saved.size), 1080)  # kichraytirilgan
        self.assertEqual(self.client.get(url).status_code, 401)  # tizimga kirmaganga yo'q

    def test_team_project_can_have_cover(self):
        item = PortfolioItem.objects.get(owner=self.dev, project=self.project)
        self.assertEqual(self.upload(self.dev, item, png()).status_code, 200)

    def test_exif_removed(self):
        item = self.manual_item()
        self.upload(self.dev, item, png(exif=True))
        item.refresh_from_db()
        with item.cover.open("rb") as handle:
            self.assertFalse(Image.open(handle).getexif())

    def test_replace_and_remove_delete_old_files_after_commit(self):
        item = self.manual_item()
        self.upload(self.dev, item, png())
        item.refresh_from_db()
        storage, first = item.cover.storage, item.cover.name
        with self.captureOnCommitCallbacks(execute=True):
            self.upload(self.dev, item, png(size=(300, 300)))
        item.refresh_from_db()
        self.assertFalse(storage.exists(first))
        second = item.cover.name
        with self.captureOnCommitCallbacks(execute=True):
            res = client_for(self.dev).delete(f"/api/portfolio/items/{item.pk}/cover/")
        self.assertEqual(res.status_code, 200)
        self.assertIsNone(res.data["cover"])
        self.assertFalse(storage.exists(second))
        self.assertEqual(client_for(self.dept).get(f"/api/portfolio/covers/{item.pk}/").status_code, 404)

    def test_cover_file_removed_when_item_deleted(self):
        item = self.manual_item()
        self.upload(self.dev, item, png())
        item.refresh_from_db()
        storage, name = item.cover.storage, item.cover.name
        with self.captureOnCommitCallbacks(execute=True):
            client_for(self.dev).delete(f"/api/portfolio/items/{item.pk}/")
        self.assertFalse(storage.exists(name))

    def test_only_owner_can_change_cover(self):
        item = self.manual_item()
        for user in (self.other, self.pm, self.dept):
            self.assertEqual(self.upload(user, item, png()).status_code, 403)
            self.assertEqual(client_for(user).delete(f"/api/portfolio/items/{item.pk}/cover/").status_code, 403)
        item.refresh_from_db()
        self.assertFalse(item.cover)

    def test_rejects_non_image_and_missing_file(self):
        item = self.manual_item()
        fake = SimpleUploadedFile("cover.png", b"MZ" + b"\x00" * 200, content_type="image/png")
        res = self.upload(self.dev, item, fake)
        self.assertEqual(res.status_code, 400)
        self.assertIn("cover", res.data["fields"])
        self.assertEqual(client_for(self.dev).post(f"/api/portfolio/items/{item.pk}/cover/", {}).status_code, 400)
        item.refresh_from_db()
        self.assertFalse(item.cover)

    def test_inactive_owner_cover_hidden(self):
        item = self.manual_item()
        self.upload(self.dev, item, png())
        self.dev.is_active = False
        self.dev.save(update_fields=["is_active"])
        self.assertEqual(client_for(self.dept).get(f"/api/portfolio/covers/{item.pk}/").status_code, 404)
