"""Dasturchi profili: texnologiyalar, loyiha holati, muqova rasmi va dasturchining barcha sharhlari."""
import io
import shutil
import tempfile
from datetime import timedelta

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from PIL import Image

from apps.accounts.models import Role
from apps.panel.tests.factories import client_for, make_user, today
from apps.projects.models import Project

from ..models import PortfolioItem, PortfolioReview
from .test_api import PortfolioTestCase


def png(name="cover.png", size=(40, 20)):
    buffer = io.BytesIO()
    Image.new("RGBA", size, (120, 80, 200, 255)).save(buffer, "PNG")
    return SimpleUploadedFile(name, buffer.getvalue(), content_type="image/png")


class TechnologyTests(PortfolioTestCase):
    def test_technologies_are_cleaned_and_saved(self):
        res = client_for(self.dev).post("/api/portfolio/items/", {
            "title": "Sayt", "technologies": [" Python ", "python", "Django", ""]}, format="json")
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data["technologies"], ["Python", "Django"])

    def test_too_many_or_too_long_technologies_are_rejected(self):
        client = client_for(self.dev)
        self.assertEqual(client.post("/api/portfolio/items/", {
            "title": "A", "technologies": [f"t{i}" for i in range(11)]}, format="json").status_code, 400)
        self.assertEqual(client.post("/api/portfolio/items/", {
            "title": "A", "technologies": ["x" * 31]}, format="json").status_code, 400)

    def test_team_project_technologies_can_be_set_by_owner_only(self):
        item = PortfolioItem.objects.get(owner=self.dev, project=self.project)
        ok = client_for(self.dev).patch(f"/api/portfolio/items/{item.pk}/", {"technologies": ["React"]}, format="json")
        self.assertEqual(ok.status_code, 200, ok.data)
        denied = client_for(self.other).patch(f"/api/portfolio/items/{item.pk}/", {"technologies": ["X"]}, format="json")
        self.assertEqual(denied.status_code, 403)

    def test_developer_technologies_are_sum_of_projects_most_used_first(self):
        self.manual_item(title="A", technologies=["Django", "React"])
        self.manual_item(title="B", technologies=["django", "Python"])
        res = client_for(make_user(Role.USER)).get(f"/api/portfolio/{self.dev.pk}/")
        self.assertEqual(res.status_code, 200)
        first = res.data["technologies"][0]
        self.assertEqual((first["name"].lower(), first["projects"]), ("django", 2))
        self.assertEqual({t["name"].lower() for t in res.data["technologies"]}, {"django", "react", "python"})


class ItemStatusTests(PortfolioTestCase):
    def status_of(self, item):
        rows = client_for(self.dept).get(f"/api/portfolio/{self.dev.pk}/").data["items"]
        return next(r for r in rows if r["id"] == item.pk)["status"]

    def test_team_project_status_comes_from_stage(self):
        item = PortfolioItem.objects.get(owner=self.dev, project=self.project)
        self.assertEqual(self.status_of(item), "planned")
        Project.objects.filter(pk=self.project.pk).update(stage=Project.Stage.STARTED)
        self.assertEqual(self.status_of(item), "active")
        Project.objects.filter(pk=self.project.pk).update(stage=Project.Stage.DONE)
        self.assertEqual(self.status_of(item), "done")

    def test_manual_item_status_comes_from_dates(self):
        future = self.manual_item(title="F", start_date=today() + timedelta(days=5))
        past = self.manual_item(title="P", start_date=today() - timedelta(days=50), end_date=today() - timedelta(days=1))
        running = self.manual_item(title="R", start_date=today() - timedelta(days=5))
        undated = self.manual_item(title="U")
        self.assertEqual(self.status_of(future), "planned")
        self.assertEqual(self.status_of(past), "done")
        self.assertEqual(self.status_of(running), "active")
        self.assertIsNone(self.status_of(undated))

    def test_card_has_short_summary_not_full_description(self):
        item = self.manual_item(title="Uzun", description="a" * 1000)
        rows = client_for(self.dept).get(f"/api/portfolio/{self.dev.pk}/").data["items"]
        summary = next(r for r in rows if r["id"] == item.pk)["summary"]
        self.assertLessEqual(len(summary), 201)


class CoverTests(PortfolioTestCase):
    def setUp(self):
        super().setUp()
        media = tempfile.mkdtemp(prefix="teamflow-test-media-")
        self.addCleanup(shutil.rmtree, media, ignore_errors=True)
        override = override_settings(MEDIA_ROOT=media)
        override.enable()
        self.addCleanup(override.disable)
        self.item = self.manual_item(title="Rasmli")

    def upload(self, user, file):
        return client_for(user).post(f"/api/portfolio/items/{self.item.pk}/cover/", {"cover": file}, format="multipart")

    def test_owner_uploads_and_everyone_can_view_cover(self):
        res = self.upload(self.dev, png())
        self.assertEqual(res.status_code, 200, res.data)
        url = res.data["cover"]
        self.assertTrue(url.startswith(f"/api/portfolio/covers/{self.item.pk}/"))
        image = client_for(make_user(Role.USER)).get(url.split("?")[0])
        self.assertEqual(image.status_code, 200)
        self.assertEqual(image["Content-Type"], "image/jpeg")
        self.assertEqual(client_for(make_user(Role.USER)).get(f"/api/portfolio/{self.dev.pk}/").data["items"][0]["cover"] is not None, True)

    def test_only_owner_changes_cover(self):
        self.assertEqual(self.upload(self.other, png()).status_code, 403)
        self.assertEqual(client_for(self.other).delete(f"/api/portfolio/items/{self.item.pk}/cover/").status_code, 403)

    def test_non_image_is_rejected(self):
        fake = SimpleUploadedFile("cover.png", b"not an image", content_type="image/png")
        self.assertEqual(self.upload(self.dev, fake).status_code, 400)

    def test_cover_can_be_removed(self):
        self.upload(self.dev, png())
        res = client_for(self.dev).delete(f"/api/portfolio/items/{self.item.pk}/cover/")
        self.assertEqual(res.status_code, 200)
        self.assertIsNone(res.data["cover"])
        self.assertEqual(client_for(self.dev).get(f"/api/portfolio/covers/{self.item.pk}/").status_code, 404)

    def test_missing_file_is_a_field_error(self):
        res = client_for(self.dev).post(f"/api/portfolio/items/{self.item.pk}/cover/", {}, format="multipart")
        self.assertEqual(res.status_code, 400)


class DeveloperReviewsTests(PortfolioTestCase):
    def test_lists_reviews_from_all_projects_with_project_title(self):
        a = self.manual_item(title="A")
        b = self.manual_item(title="B")
        PortfolioReview.objects.create(item=a, author=self.pm, stars=5, text="Zo'r")
        PortfolioReview.objects.create(item=b, author=self.dept, stars=3)
        res = client_for(make_user(Role.USER)).get(f"/api/portfolio/{self.dev.pk}/reviews/")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["count"], 2)
        self.assertEqual({r["item_title"] for r in res.data["results"]}, {"A", "B"})
        self.assertEqual(res.data["results"][0]["author"]["id"] in (self.pm.pk, self.dept.pk), True)

    def test_other_developers_reviews_are_not_included(self):
        mine = self.manual_item(title="A")
        theirs = self.manual_item(owner=self.other, title="Boshqa")
        PortfolioReview.objects.create(item=mine, author=self.pm, stars=4)
        PortfolioReview.objects.create(item=theirs, author=self.pm, stars=1)
        res = client_for(self.dept).get(f"/api/portfolio/{self.dev.pk}/reviews/")
        self.assertEqual([r["item_title"] for r in res.data["results"]], ["A"])

    def test_unknown_or_inactive_developer_is_404(self):
        self.assertEqual(client_for(self.dept).get("/api/portfolio/99999/reviews/").status_code, 404)
        self.assertEqual(client_for(self.dept).get(f"/api/portfolio/{self.pm.pk}/reviews/").status_code, 404)

    def test_query_count_is_flat(self):
        from django.db import connection
        from django.test.utils import CaptureQueriesContext
        item = self.manual_item(title="A")
        for i in range(6):
            PortfolioReview.objects.create(item=item, author=make_user(Role.USER), stars=5)
        with CaptureQueriesContext(connection) as ctx:
            client_for(self.dept).get(f"/api/portfolio/{self.dev.pk}/reviews/")
        self.assertLess(len(ctx), 8)
