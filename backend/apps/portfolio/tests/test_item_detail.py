"""Portfolio loyiha oynasi: galereya, TeamFlow loyihasi ma'lumotlari (mas'ul, jarayon, bajarilgan ishlar, jamoa), baholash."""
import io
import shutil
import tempfile

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.utils import timezone
from PIL import Image

from apps.accounts.models import Role
from apps.panel.tests.factories import client_for, make_task, make_user
from apps.projects.models import ProjectMember
from apps.tasks.models import Task

from ..models import PortfolioImage, PortfolioItem
from .test_api import PortfolioTestCase


def png(name="shot.png"):
    buffer = io.BytesIO()
    Image.new("RGBA", (60, 30), (10, 120, 200, 255)).save(buffer, "PNG")
    return SimpleUploadedFile(name, buffer.getvalue(), content_type="image/png")


class MediaTestCase(PortfolioTestCase):
    def setUp(self):
        super().setUp()
        media = tempfile.mkdtemp(prefix="teamflow-test-media-")
        self.addCleanup(shutil.rmtree, media, ignore_errors=True)
        override = override_settings(MEDIA_ROOT=media)
        override.enable()
        self.addCleanup(override.disable)


class GalleryTests(MediaTestCase):
    def setUp(self):
        super().setUp()
        self.item = self.manual_item(title="Galereyali")

    def url(self, suffix=""):
        return f"/api/portfolio/items/{self.item.pk}/images/{suffix}"

    def test_owner_uploads_and_payload_lists_images(self):
        res = client_for(self.dev).post(self.url(), {"image": png()}, format="multipart")
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(len(res.data["images"]), 1)
        again = client_for(make_user(Role.USER)).get(f"/api/portfolio/items/{self.item.pk}/")
        self.assertEqual(again.data["images"], res.data["images"])  # qayta ochilganda ham saqlangan

    def test_everyone_logged_in_views_image_file_as_jpeg(self):
        image = client_for(self.dev).post(self.url(), {"image": png()}, format="multipart").data["images"][0]
        res = client_for(make_user(Role.USER)).get(image["url"])
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res["Content-Type"], "image/jpeg")

    def test_only_owner_changes_gallery(self):
        self.assertEqual(client_for(self.other).post(self.url(), {"image": png()}, format="multipart").status_code, 403)
        image = PortfolioImage(item=self.item)
        image.file.save("x.jpg", SimpleUploadedFile("x.jpg", b"x"), save=True)
        self.assertEqual(client_for(self.other).delete(self.url(f"{image.pk}/")).status_code, 403)
        self.assertTrue(PortfolioImage.objects.filter(pk=image.pk).exists())

    def test_non_image_and_missing_file_are_rejected(self):
        fake = SimpleUploadedFile("shot.png", b"not an image", content_type="image/png")
        self.assertEqual(client_for(self.dev).post(self.url(), {"image": fake}, format="multipart").status_code, 400)
        self.assertEqual(client_for(self.dev).post(self.url(), {}, format="multipart").status_code, 400)

    @override_settings(PORTFOLIO_IMAGES_PER_ITEM=2)
    def test_gallery_limit(self):
        client = client_for(self.dev)
        for _ in range(2):
            self.assertEqual(client.post(self.url(), {"image": png()}, format="multipart").status_code, 201)
        self.assertEqual(client.post(self.url(), {"image": png()}, format="multipart").status_code, 400)

    def test_owner_deletes_image(self):
        client = client_for(self.dev)
        image = client.post(self.url(), {"image": png()}, format="multipart").data["images"][0]
        res = client.delete(self.url(f"{image['id']}/"))
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["images"], [])
        self.assertEqual(client.get(image["url"]).status_code, 404)

    def test_image_of_other_item_cannot_be_deleted_through_this_item(self):
        other_item = self.manual_item(title="Boshqa")
        image = PortfolioImage(item=other_item)
        image.file.save("x.jpg", SimpleUploadedFile("x.jpg", b"x"), save=True)
        self.assertEqual(client_for(self.dev).delete(self.url(f"{image.pk}/")).status_code, 404)


class ProjectWorkTests(PortfolioTestCase):
    def setUp(self):
        super().setUp()
        self.item = PortfolioItem.objects.get(owner=self.dev, project=self.project)
        ProjectMember.objects.create(project=self.project, developer=self.other)
        make_task(self.project, self.pm, self.dev, title="Mening ishim", status=Task.Status.DONE, completed_at=timezone.now())
        make_task(self.project, self.pm, self.other, title="Boshqaning ishi", status=Task.Status.DONE, completed_at=timezone.now())
        make_task(self.project, self.pm, self.dev, title="Hali tugamagan")
        make_task(self.project, self.pm, self.dev, title="Arxivda", archived_at=timezone.now())

    def work(self, viewer=None):
        return client_for(viewer or make_user(Role.USER)).get(f"/api/portfolio/items/{self.item.pk}/").data["work"]

    def test_team_project_shows_lead_progress_own_done_tasks_and_team(self):
        work = self.work()
        self.assertEqual(work["lead"]["id"], self.pm.pk)
        self.assertEqual(work["progress"], {"total": 3, "done": 2})  # arxivlangan hisobga olinmaydi
        self.assertEqual([t["title"] for t in work["completed_tasks"]], ["Mening ishim"])
        self.assertEqual({u["id"] for u in work["team"]}, {self.dev.pk, self.other.pk})

    def test_inactive_member_is_not_in_team(self):
        self.other.is_active = False
        self.other.save(update_fields=["is_active"])
        self.assertEqual({u["id"] for u in self.work()["team"]}, {self.dev.pk})

    def test_manual_item_has_no_work_block(self):
        manual = self.manual_item(title="Shaxsiy")
        res = client_for(self.dept).get(f"/api/portfolio/items/{manual.pk}/")
        self.assertIsNone(res.data["work"])

    def test_detail_query_count_is_flat(self):
        from django.db import connection
        from django.test.utils import CaptureQueriesContext
        for i in range(6):
            make_task(self.project, self.pm, self.dev, title=f"Ish {i}", status=Task.Status.DONE, completed_at=timezone.now())
        with CaptureQueriesContext(connection) as ctx:
            client_for(self.dept).get(f"/api/portfolio/items/{self.item.pk}/")
        self.assertLess(len(ctx), 16)


class ReviewRulesTests(PortfolioTestCase):
    def setUp(self):
        super().setUp()
        self.item = self.manual_item(title="Baholanadi")
        self.url = f"/api/portfolio/items/{self.item.pk}/reviews/"

    def test_stars_must_be_between_1_and_5(self):
        for bad in (0, 6, -1, "x", None):
            res = client_for(self.pm).post(self.url, {"stars": bad}, format="json")
            self.assertEqual(res.status_code, 400, bad)
        self.assertEqual(self.item.reviews.count(), 0)

    def test_text_limit(self):
        self.assertEqual(client_for(self.pm).post(self.url, {"stars": 5, "text": "a" * 1001}, format="json").status_code, 400)

    def test_owner_cannot_review_own_project(self):
        self.assertEqual(client_for(self.dev).post(self.url, {"stars": 5}, format="json").status_code, 403)

    def test_average_is_real_and_review_is_updated_not_duplicated(self):
        client_for(self.pm).post(self.url, {"stars": 5, "text": "Zo'r"}, format="json")
        res = client_for(self.dept).post(self.url, {"stars": 2}, format="json")
        self.assertEqual(res.data["rating"], 3.5)
        again = client_for(self.pm).post(self.url, {"stars": 3}, format="json")
        self.assertEqual(again.data["rating"], 2.5)
        self.assertEqual(self.item.reviews.count(), 2)
        reopened = client_for(self.pm).get(f"/api/portfolio/items/{self.item.pk}/")
        self.assertEqual(reopened.data["my_review"]["stars"], 3)
        self.assertEqual(reopened.data["reviews_count"], 2)

    def test_ordinary_user_can_review(self):
        self.assertEqual(client_for(make_user(Role.USER)).post(self.url, {"stars": 4}, format="json").status_code, 200)

    def test_anonymous_cannot_review(self):
        from rest_framework.test import APIClient
        self.assertIn(APIClient().post(self.url, {"stars": 4}, format="json").status_code, (401, 403))
