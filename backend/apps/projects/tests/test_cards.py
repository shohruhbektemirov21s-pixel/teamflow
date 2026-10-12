"""Loyihalar ro'yxati: holat filtri (Bajarilgan · Jarayonda · Kechikkan), texnologiyalar va muqova rasmi."""
import io
import shutil
import tempfile
from datetime import timedelta

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from PIL import Image

from apps.accounts.models import Role
from apps.panel.tests.factories import client_for, make_user, today
from apps.projects.models import Project, ProjectMember
from apps.projects.workflow import project_status


def png(name="cover.png"):
    buffer = io.BytesIO()
    Image.new("RGBA", (40, 20), (120, 80, 200, 255)).save(buffer, "PNG")
    return SimpleUploadedFile(name, buffer.getvalue(), content_type="image/png")


class ProjectCardTestCase(TestCase):
    def setUp(self):
        self.pm = make_user(Role.PM)
        self.dev = make_user(Role.DEVELOPER)
        self.other = make_user(Role.DEVELOPER)
        self.dept = make_user(Role.DEPARTMENT)

    def project(self, code, stage=Project.Stage.STARTED, start=-10, end=10, **kw):
        return Project.objects.create(code=code, name=f"Loyiha {code}", stage=stage, created_by=self.pm,
                                      start_date=today() + timedelta(days=start), end_date=today() + timedelta(days=end), **kw)


class StatusFilterTests(ProjectCardTestCase):
    def setUp(self):
        super().setUp()
        self.done = self.project("D", Project.Stage.DONE, end=-5)  # muddati o'tgan bo'lsa ham yakunlangan
        self.active = self.project("A")
        self.planned = self.project("P", Project.Stage.PLANNED, start=3, end=30)
        self.overdue = self.project("O", end=-1)
        self.today = self.project("T", end=0)  # bugun tugaydi — hali kechikmagan

    def codes(self, **params):
        res = client_for(self.pm).get("/api/projects/", params)
        self.assertEqual(res.status_code, 200)
        return {p["code"] for p in res.data["results"]}

    def test_each_status_filters_exactly(self):
        self.assertEqual(self.codes(status="done"), {"D"})
        self.assertEqual(self.codes(status="active"), {"A", "P", "T"})
        self.assertEqual(self.codes(status="overdue"), {"O"})

    def test_filters_are_exclusive_and_cover_everything(self):
        parts = [self.codes(status=s) for s in ("done", "active", "overdue")]
        self.assertEqual(sum(len(p) for p in parts), len(self.codes()))
        self.assertEqual(set().union(*parts), self.codes())

    def test_row_status_matches_filter(self):
        rows = {p["code"]: p["status"] for p in client_for(self.pm).get("/api/projects/").data["results"]}
        self.assertEqual(rows, {"D": "done", "A": "active", "P": "active", "O": "overdue", "T": "active"})
        for project in Project.objects.all():
            self.assertEqual(rows[project.code], project_status(project))

    def test_unknown_status_is_ignored(self):
        self.assertEqual(self.codes(status="nope"), self.codes())

    def test_status_combines_with_search_and_pagination(self):
        self.assertEqual(self.codes(status="overdue", q="Loyiha O"), {"O"})
        self.assertEqual(self.codes(status="overdue", q="Loyiha A"), set())
        res = client_for(self.pm).get("/api/projects/", {"status": "active", "page_size": 2})
        self.assertEqual(len(res.data["results"]), 2)
        self.assertEqual(res.data["count"], 3)

    def test_developer_sees_only_own_projects_in_every_status(self):
        ProjectMember.objects.create(project=self.overdue, developer=self.dev)
        client = client_for(self.dev)
        self.assertEqual({p["code"] for p in client.get("/api/projects/", {"status": "overdue"}).data["results"]}, {"O"})
        self.assertEqual(client.get("/api/projects/", {"status": "active"}).data["results"], [])
        self.assertEqual(client_for(self.other).get("/api/projects/").data["results"], [])

    def test_department_sees_no_projects(self):
        self.assertEqual(client_for(self.dept).get("/api/projects/").data["results"], [])

    def test_list_query_count_is_flat(self):
        from django.db import connection
        from django.test.utils import CaptureQueriesContext
        for i in range(8):
            project = self.project(f"X{i}")
            ProjectMember.objects.create(project=project, developer=self.dev)
        with CaptureQueriesContext(connection) as ctx:
            client_for(self.pm).get("/api/projects/")
        self.assertLess(len(ctx), 10)


class TechnologyTests(ProjectCardTestCase):
    def test_create_cleans_technologies(self):
        res = client_for(self.pm).post("/api/projects/", {
            "code": "T-1", "name": "Sayt", "start_date": today().isoformat(), "end_date": (today() + timedelta(days=5)).isoformat(),
            "technologies": [" Python ", "python", "Django", ""]}, format="json")
        self.assertEqual(res.status_code, 201, res.data)
        self.assertEqual(res.data["technologies"], ["Python", "Django"])

    def test_too_many_technologies_are_rejected(self):
        res = client_for(self.pm).post("/api/projects/", {
            "code": "T-2", "name": "Sayt", "start_date": today().isoformat(), "end_date": (today() + timedelta(days=5)).isoformat(),
            "technologies": [f"t{i}" for i in range(11)]}, format="json")
        self.assertEqual(res.status_code, 400)

    def test_update_changes_technologies_without_touching_info(self):
        project = self.project("U")
        res = client_for(self.pm).patch(f"/api/projects/{project.pk}/", {"technologies": ["React"]}, format="json")
        self.assertEqual(res.status_code, 200, res.data)
        self.assertEqual(res.data["technologies"], ["React"])
        self.assertEqual(res.data["name"], project.name)

    def test_only_managers_edit_technologies(self):
        project = self.project("V")
        ProjectMember.objects.create(project=project, developer=self.dev)
        self.assertEqual(client_for(self.dev).patch(f"/api/projects/{project.pk}/", {"technologies": ["X"]}, format="json").status_code, 403)

    def test_list_returns_technologies(self):
        self.project("W", technologies=["Vue"])
        rows = client_for(self.pm).get("/api/projects/").data["results"]
        self.assertEqual(rows[0]["technologies"], ["Vue"])


class CoverTests(ProjectCardTestCase):
    def setUp(self):
        super().setUp()
        media = tempfile.mkdtemp(prefix="teamflow-test-media-")
        self.addCleanup(shutil.rmtree, media, ignore_errors=True)
        override = override_settings(MEDIA_ROOT=media)
        override.enable()
        self.addCleanup(override.disable)
        self.item = self.project("C")
        ProjectMember.objects.create(project=self.item, developer=self.dev)

    def upload(self, user, file):
        return client_for(user).post(f"/api/projects/{self.item.pk}/cover/", {"cover": file}, format="multipart")

    def test_manager_uploads_and_members_view_cover(self):
        res = self.upload(self.pm, png())
        self.assertEqual(res.status_code, 200, res.data)
        url = res.data["cover"]
        self.assertTrue(url.startswith(f"/api/projects/{self.item.pk}/cover-image/"))
        for viewer in (self.pm, self.dev):
            image = client_for(viewer).get(url.split("?")[0])
            self.assertEqual(image.status_code, 200)
            self.assertEqual(image["Content-Type"], "image/jpeg")

    def test_non_member_cannot_view_cover(self):
        self.upload(self.pm, png())
        self.assertEqual(client_for(self.other).get(f"/api/projects/{self.item.pk}/cover-image/").status_code, 404)
        self.assertEqual(client_for(self.dept).get(f"/api/projects/{self.item.pk}/cover-image/").status_code, 404)

    def test_only_managers_change_cover(self):
        self.assertEqual(self.upload(self.dev, png()).status_code, 403)
        self.assertEqual(client_for(self.dev).delete(f"/api/projects/{self.item.pk}/cover/").status_code, 403)

    def test_non_image_is_rejected(self):
        fake = SimpleUploadedFile("cover.png", b"not an image", content_type="image/png")
        self.assertEqual(self.upload(self.pm, fake).status_code, 400)

    def test_cover_can_be_removed(self):
        self.upload(self.pm, png())
        res = client_for(self.pm).delete(f"/api/projects/{self.item.pk}/cover/")
        self.assertEqual(res.status_code, 200)
        self.assertIsNone(res.data["cover"])
        self.assertEqual(client_for(self.pm).get(f"/api/projects/{self.item.pk}/cover-image/").status_code, 404)

    def test_missing_file_is_400(self):
        res = client_for(self.pm).post(f"/api/projects/{self.item.pk}/cover/", {}, format="multipart")
        self.assertEqual(res.status_code, 400)
