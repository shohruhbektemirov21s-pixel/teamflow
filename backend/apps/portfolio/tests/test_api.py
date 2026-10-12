"""Portfolio: ko'rish, to'ldirish, video, baho/sharh, kuzatish va reyting tartibi."""
from datetime import timedelta

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import connection
from django.test import TestCase, override_settings
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from apps.accounts.models import Role
from apps.panel.tests.factories import client_for, make_user, today
from apps.projects.models import Project, ProjectMember
from apps.tasks.models import Task, TaskAssignment

from ..models import Follow, PortfolioItem, PortfolioReview, PortfolioVideo

MP4 = b"\x00\x00\x00\x18ftypmp42" + b"\x00" * 200


def mp4(name="demo.mp4", data=MP4):
    return SimpleUploadedFile(name, data, content_type="video/mp4")


class PortfolioTestCase(TestCase):
    def setUp(self):
        # Reyting keshi commit'dan keyin tozalanadi (TestCase'da commit yo'q) — testlar bir-biriga ta'sir qilmasin
        cache.clear()
        self.addCleanup(cache.clear)
        self.pm = make_user(Role.PM)
        self.dev = make_user(Role.DEVELOPER)
        self.other = make_user(Role.DEVELOPER)
        self.dept = make_user(Role.DEPARTMENT)
        self.project = Project.objects.create(code="PRJ-1", name="Portal", start_date=today() - timedelta(days=400),
                                              end_date=today(), created_by=self.pm)
        ProjectMember.objects.create(project=self.project, developer=self.dev)

    def manual_item(self, owner=None, **kw):
        return PortfolioItem.objects.create(owner=owner or self.dev, title=kw.pop("title", "Shaxsiy sayt"), **kw)


class ViewTests(PortfolioTestCase):
    def test_team_project_appears_automatically_with_done_tasks(self):
        task = Task.objects.create(project=self.project, title="Kirish sahifasi", created_by=self.pm,
                                   status=Task.Status.DONE, completed_at=timezone.now())
        TaskAssignment.objects.create(task=task, developer=self.dev)
        res = client_for(self.dept).get(f"/api/portfolio/{self.dev.pk}/")
        self.assertEqual(res.status_code, 200)
        items = res.data["items"]
        self.assertEqual(len(items), 1)
        self.assertTrue(items[0]["is_auto"])
        self.assertEqual(items[0]["title"], "Portal")
        self.assertEqual(items[0]["tasks_done"], 1)
        self.assertEqual(res.data["tasks_done"], 1)
        self.assertEqual(res.data["recent_tasks"][0]["title"], "Kirish sahifasi")
        self.assertGreaterEqual(res.data["experience"]["months"], 13)
        self.assertEqual(res.data["years"][0]["year"], today().year)
        # Ikkinchi ochilishda takrorlanmaydi
        client_for(self.dept).get(f"/api/portfolio/{self.dev.pk}/")
        self.assertEqual(PortfolioItem.objects.filter(owner=self.dev).count(), 1)

    def test_list_counts_unsynced_projects_and_everybody_can_view(self):
        self.manual_item()
        for user in (self.pm, self.dev, self.other, self.dept):
            res = client_for(user).get("/api/portfolio/")
            self.assertEqual(res.status_code, 200)
        row = next(r for r in res.data["results"] if r["id"] == self.dev.pk)
        self.assertEqual(row["projects_count"], 2)

    def test_only_active_developers_have_portfolio(self):
        self.assertEqual(client_for(self.dev).get(f"/api/portfolio/{self.pm.pk}/").status_code, 404)
        inactive = make_user(Role.DEVELOPER, active=False)
        self.assertEqual(client_for(self.dev).get(f"/api/portfolio/{inactive.pk}/").status_code, 404)
        ids = [r["id"] for r in client_for(self.dev).get("/api/portfolio/").data["results"]]
        self.assertNotIn(self.pm.pk, ids)
        self.assertNotIn(inactive.pk, ids)

    def test_anonymous_cannot_view(self):
        self.assertEqual(self.client.get("/api/portfolio/").status_code, 401)

    def test_list_ranked_by_rating_then_reviews(self):
        top, mid = self.manual_item(owner=self.other), self.manual_item()
        reviewers = [make_user(Role.PM) for _ in range(3)]
        PortfolioReview.objects.create(item=top, author=reviewers[0], stars=5)
        PortfolioReview.objects.create(item=mid, author=reviewers[0], stars=5)
        PortfolioReview.objects.create(item=mid, author=reviewers[1], stars=3)
        res = client_for(self.dept).get("/api/portfolio/")
        rows = res.data["results"]
        self.assertEqual([r["id"] for r in rows[:2]], [self.other.pk, self.dev.pk])
        self.assertEqual(rows[0]["rating"], 5.0)
        self.assertEqual(rows[1]["rating"], 4.0)
        self.assertEqual(rows[1]["reviews_count"], 2)
        self.assertEqual([r["rank"] for r in rows[:2]], [1, 2])

    def test_list_query_count_does_not_grow_with_developers(self):
        for _ in range(5):
            dev = make_user(Role.DEVELOPER)
            PortfolioReview.objects.create(item=self.manual_item(owner=dev), author=self.pm, stars=4)
            Follow.objects.create(follower=self.pm, developer=dev)
        client = client_for(self.dept)
        with CaptureQueriesContext(connection) as ctx:
            self.assertEqual(client.get("/api/portfolio/").status_code, 200)
        # sessiya, foydalanuvchi, reyting ro'yxati, kartalar uchun loyihalar — dasturchilar soniga bog'liq emas
        self.assertLessEqual(len(ctx.captured_queries), 4)

    def test_search_by_name(self):
        res = client_for(self.pm).get(f"/api/portfolio/?q={self.other.first_name}")
        self.assertEqual([r["id"] for r in res.data["results"]], [self.other.pk])
        self.assertIsNone(res.data["results"][0]["rank"])

    def test_following_filter_lists_only_followed_developers(self):
        client = client_for(self.dept)
        self.assertEqual(client.get("/api/portfolio/?following=1").data["results"], [])
        client.post(f"/api/portfolio/{self.dev.pk}/follow/")
        res = client.get("/api/portfolio/?following=1")
        self.assertEqual([r["id"] for r in res.data["results"]], [self.dev.pk])
        self.assertTrue(res.data["results"][0]["is_following"])
        self.assertIsNone(res.data["results"][0]["rank"])
        self.assertEqual(client_for(self.pm).get("/api/portfolio/?following=1").data["count"], 0)


class EditTests(PortfolioTestCase):
    def test_developer_adds_and_edits_own_project(self):
        client = client_for(self.dev)
        res = client.post("/api/portfolio/items/", {"title": "Telegram bot", "link": "https://github.com/x/bot",
                                                    "start_date": "2024-01-10", "end_date": "2024-05-01"},
                          format="json")
        self.assertEqual(res.status_code, 201)
        self.assertFalse(res.data["is_auto"])
        res = client.patch(f"/api/portfolio/items/{res.data['id']}/", {"description": "Bildirishnoma boti"},
                           format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["description"], "Bildirishnoma boti")

    def test_others_cannot_add_or_edit(self):
        self.assertEqual(client_for(self.pm).post("/api/portfolio/items/", {"title": "X"}, format="json").status_code, 403)
        item = self.manual_item()
        for user in (self.other, self.pm, self.dept):
            client = client_for(user)
            self.assertEqual(client.patch(f"/api/portfolio/items/{item.pk}/", {"title": "Y"}, format="json").status_code, 403)
            self.assertEqual(client.delete(f"/api/portfolio/items/{item.pk}/").status_code, 403)
            self.assertEqual(client.post(f"/api/portfolio/items/{item.pk}/videos/", {"video": mp4()}).status_code, 403)
        item.refresh_from_db()
        self.assertEqual(item.title, "Shaxsiy sayt")

    def test_validation(self):
        client = client_for(self.dev)
        self.assertEqual(client.post("/api/portfolio/items/", {"title": "  "}, format="json").status_code, 400)
        res = client.post("/api/portfolio/items/", {"title": "X", "link": "javascript:alert(1)"}, format="json")
        self.assertEqual(res.status_code, 400)
        self.assertIn("link", res.data["fields"])
        res = client.post("/api/portfolio/items/", {"title": "X", "start_date": "2025-02-01", "end_date": "2025-01-01"},
                          format="json")
        self.assertEqual(res.status_code, 400)

    def test_team_project_keeps_name_and_cannot_be_deleted(self):
        client_for(self.dev).get(f"/api/portfolio/{self.dev.pk}/")
        item = PortfolioItem.objects.get(owner=self.dev, project=self.project)
        client = client_for(self.dev)
        self.assertEqual(client.patch(f"/api/portfolio/items/{item.pk}/", {"title": "Boshqa"}, format="json").status_code, 400)
        res = client.patch(f"/api/portfolio/items/{item.pk}/", {"link": "https://portal.uz"}, format="json")
        self.assertEqual(res.data["link"], "https://portal.uz")
        self.assertEqual(client.delete(f"/api/portfolio/items/{item.pk}/").status_code, 400)

    def test_manual_item_delete(self):
        item = self.manual_item()
        self.assertEqual(client_for(self.dev).delete(f"/api/portfolio/items/{item.pk}/").status_code, 204)
        self.assertFalse(PortfolioItem.objects.filter(pk=item.pk).exists())


class VideoTests(PortfolioTestCase):
    def test_upload_view_with_range_and_delete(self):
        item = self.manual_item()
        res = client_for(self.dev).post(f"/api/portfolio/items/{item.pk}/videos/", {"video": mp4()})
        self.assertEqual(res.status_code, 201)
        url = res.data["url"]
        viewer = client_for(self.dept)
        full = viewer.get(url)
        self.assertEqual(full.status_code, 200)
        self.assertEqual(full["Content-Type"], "video/mp4")
        self.assertEqual(full["Accept-Ranges"], "bytes")
        self.assertEqual(b"".join(full.streaming_content), MP4)
        part = viewer.get(url, HTTP_RANGE="bytes=4-11")
        self.assertEqual(part.status_code, 206)
        self.assertEqual(part["Content-Range"], f"bytes 4-11/{len(MP4)}")
        self.assertEqual(b"".join(part.streaming_content), b"ftypmp42")
        self.assertEqual(viewer.get(url, HTTP_RANGE=f"bytes={len(MP4)}-").status_code, 416)
        self.assertEqual(self.client.get(url).status_code, 401)
        video = PortfolioVideo.objects.get()
        self.assertEqual(client_for(self.other).delete(f"/api/portfolio/items/{item.pk}/videos/{video.pk}/").status_code, 403)
        self.assertEqual(client_for(self.dev).delete(f"/api/portfolio/items/{item.pk}/videos/{video.pk}/").status_code, 204)
        self.assertFalse(PortfolioVideo.objects.exists())

    def test_rejects_non_video(self):
        item = self.manual_item()
        client = client_for(self.dev)
        self.assertEqual(client.post(f"/api/portfolio/items/{item.pk}/videos/", {"video": mp4("x.exe")}).status_code, 400)
        fake = mp4("fake.mp4", b"MZ" + b"\x00" * 100)
        self.assertEqual(client.post(f"/api/portfolio/items/{item.pk}/videos/", {"video": fake}).status_code, 400)
        self.assertEqual(client.post(f"/api/portfolio/items/{item.pk}/videos/", {}).status_code, 400)
        self.assertFalse(PortfolioVideo.objects.exists())

    def test_video_file_removed_on_cascade_delete_only_after_commit(self):
        item = self.manual_item()
        video = PortfolioVideo.objects.create(item=item, file=mp4(), original_name="a.mp4")
        storage, name = video.file.storage, video.file.name
        with self.captureOnCommitCallbacks(execute=False):
            item.delete()  # tranzaksiya tasdiqlanmagan — fayl hali joyida
        self.assertTrue(storage.exists(name))
        video = PortfolioVideo.objects.create(item=self.manual_item(), file=mp4(), original_name="b.mp4")
        name = video.file.name
        with self.captureOnCommitCallbacks(execute=True):
            self.dev.delete()  # foydalanuvchi o'chsa ham (CASCADE) fayl qolmaydi
        self.assertFalse(storage.exists(name))

    @override_settings(PORTFOLIO_VIDEO_MAX_MB=0)
    def test_rejects_too_big(self):
        item = self.manual_item()
        self.assertEqual(client_for(self.dev).post(f"/api/portfolio/items/{item.pk}/videos/", {"video": mp4()}).status_code, 400)

    @override_settings(PORTFOLIO_VIDEOS_PER_ITEM=1)
    def test_video_limit_per_item(self):
        item = self.manual_item()
        client = client_for(self.dev)
        self.assertEqual(client.post(f"/api/portfolio/items/{item.pk}/videos/", {"video": mp4()}).status_code, 201)
        self.assertEqual(client.post(f"/api/portfolio/items/{item.pk}/videos/", {"video": mp4()}).status_code, 400)


class ReviewTests(PortfolioTestCase):
    def test_review_create_update_and_delete(self):
        item = self.manual_item()
        client = client_for(self.dept)
        res = client.post(f"/api/portfolio/items/{item.pk}/reviews/", {"stars": 4, "text": "Zo'r"}, format="json")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.data["rating"], 4.0)
        self.assertEqual(res.data["my_review"]["text"], "Zo'r")
        res = client.post(f"/api/portfolio/items/{item.pk}/reviews/", {"stars": 2}, format="json")
        self.assertEqual(res.data["reviews_count"], 1)
        self.assertEqual(res.data["rating"], 2.0)
        listing = client_for(self.other).get(f"/api/portfolio/items/{item.pk}/reviews/")
        self.assertEqual(listing.data["count"], 1)
        res = client.delete(f"/api/portfolio/items/{item.pk}/reviews/")
        self.assertIsNone(res.data["my_review"])
        self.assertFalse(PortfolioReview.objects.exists())

    def test_my_reviews_lists_only_own_reviews_and_profile_counts_them(self):
        user = make_user(Role.USER)
        mine, theirs = self.manual_item(), self.manual_item(owner=self.other, title="Boshqa")
        client_for(user).post(f"/api/portfolio/items/{mine.pk}/reviews/", {"stars": 5, "text": "Ajoyib"}, format="json")
        client_for(self.dept).post(f"/api/portfolio/items/{theirs.pk}/reviews/", {"stars": 1}, format="json")
        client_for(user).post(f"/api/portfolio/{self.dev.pk}/follow/")
        res = client_for(user).get("/api/portfolio/my-reviews/")
        self.assertEqual(res.data["count"], 1)
        row = res.data["results"][0]
        self.assertEqual((row["item_id"], row["stars"], row["developer"]["id"]), (mine.pk, 5, self.dev.pk))
        self.assertEqual(client_for(user).get("/api/auth/profile/").data["activity"], {"reviews": 1, "following": 1})
        self.assertIsNone(client_for(self.dev).get("/api/auth/profile/").data["activity"])

    def test_summary_and_specialty_filter(self):
        from apps.accounts.models import Specialty
        spec = Specialty.objects.create(name="Backend")
        self.dev.specialty = spec
        self.dev.save()
        item = self.manual_item()
        client_for(self.dept).post(f"/api/portfolio/items/{item.pk}/reviews/", {"stars": 4}, format="json")
        client_for(self.pm).post(f"/api/portfolio/items/{item.pk}/reviews/", {"stars": 5}, format="json")
        cache.clear()
        data = client_for(self.dept).get("/api/portfolio/summary/").data
        self.assertEqual((data["developers"], data["average_rating"], data["rated_projects"]), (2, 4.5, 1))
        self.assertEqual(data["specialties"], [{"id": spec.pk, "name": "Backend", "count": 1}])
        self.assertEqual((data["active_projects"], data["following"]), (1, 0))
        client_for(self.dept).post(f"/api/portfolio/{self.dev.pk}/follow/")
        self.assertEqual(client_for(self.dept).get("/api/portfolio/summary/").data["following"], 1)
        res = client_for(self.dept).get(f"/api/portfolio/?specialty={spec.pk}")
        self.assertEqual([r["id"] for r in res.data["results"]], [self.dev.pk])

    def test_card_highlights_come_from_backend(self):
        self.manual_item(title="Shaxsiy sayt")
        row = next(r for r in client_for(self.dept).get("/api/portfolio/").data["results"] if r["id"] == self.dev.pk)
        self.assertCountEqual(row["projects"], ["Portal", "Shaxsiy sayt"])
        self.assertEqual(row["projects_extra"], 0)
        self.assertGreaterEqual(row["experience_months"], 12)

    def test_sort_by_followers(self):
        client_for(self.dept).post(f"/api/portfolio/{self.other.pk}/follow/")
        res = client_for(self.pm).get("/api/portfolio/?sort=followers")
        self.assertEqual(res.data["results"][0]["id"], self.other.pk)
        self.assertIsNone(res.data["results"][0]["rank"])
        self.assertEqual(client_for(self.pm).get("/api/portfolio/?sort=bad").data["results"][0]["rank"], 1)

    def test_owner_cannot_review_own_project(self):
        item = self.manual_item()
        res = client_for(self.dev).post(f"/api/portfolio/items/{item.pk}/reviews/", {"stars": 5}, format="json")
        self.assertEqual(res.status_code, 403)
        self.assertFalse(client_for(self.dev).get(f"/api/portfolio/items/{item.pk}/").data["actions"]["review"])

    def test_stars_must_be_1_to_5(self):
        item = self.manual_item()
        for stars in (0, 6, "a"):
            res = client_for(self.pm).post(f"/api/portfolio/items/{item.pk}/reviews/", {"stars": stars}, format="json")
            self.assertEqual(res.status_code, 400)

    def test_developer_rating_is_average_of_all_project_reviews(self):
        a, b = self.manual_item(), self.manual_item(title="Ikkinchi")
        PortfolioReview.objects.create(item=a, author=self.pm, stars=5)
        PortfolioReview.objects.create(item=b, author=self.pm, stars=4)
        PortfolioReview.objects.create(item=b, author=self.dept, stars=3)
        PortfolioVideo.objects.create(item=b, file=mp4(), original_name="a.mp4")
        PortfolioVideo.objects.create(item=b, file=mp4(), original_name="b.mp4")
        res = client_for(self.other).get(f"/api/portfolio/{self.dev.pk}/")
        self.assertEqual(res.data["rating"], 4.0)
        self.assertEqual(res.data["reviews_count"], 3)
        by_id = {i["id"]: i for i in res.data["items"]}
        self.assertEqual(by_id[b.pk]["rating"], 3.5)
        self.assertEqual(by_id[b.pk]["videos_count"], 2)


class FollowTests(PortfolioTestCase):
    def test_follow_and_unfollow(self):
        client = client_for(self.dept)
        res = client.post(f"/api/portfolio/{self.dev.pk}/follow/")
        self.assertEqual(res.status_code, 200)
        self.assertTrue(res.data["is_following"])
        self.assertEqual(res.data["followers_count"], 1)
        client.post(f"/api/portfolio/{self.dev.pk}/follow/")  # takroriy — xato emas
        self.assertEqual(Follow.objects.count(), 1)
        res = client.delete(f"/api/portfolio/{self.dev.pk}/follow/")
        self.assertFalse(res.data["is_following"])
        self.assertEqual(res.data["followers_count"], 0)

    def test_cannot_follow_self_or_non_developer(self):
        self.assertEqual(client_for(self.dev).post(f"/api/portfolio/{self.dev.pk}/follow/").status_code, 400)
        self.assertEqual(client_for(self.dev).post(f"/api/portfolio/{self.pm.pk}/follow/").status_code, 404)
        self.assertFalse(client_for(self.dev).get(f"/api/portfolio/{self.dev.pk}/").data["actions"]["follow"])
        self.assertFalse(Follow.objects.exists())

    def test_ratings_feed_search_sort_and_mine(self):
        user = make_user(Role.USER)
        site, shop = self.manual_item(title="Shaxsiy sayt"), self.manual_item(owner=self.other, title="Do'kon")
        client_for(user).post(f"/api/portfolio/items/{site.pk}/reviews/", {"stars": 2, "text": "Oddiy"}, format="json")
        client_for(self.dept).post(f"/api/portfolio/items/{shop.pk}/reviews/", {"stars": 5, "text": "Ajoyib"}, format="json")
        hidden = self.manual_item(owner=make_user(Role.DEVELOPER), title="Yashirin")
        client_for(user).post(f"/api/portfolio/items/{hidden.pk}/reviews/", {"stars": 4}, format="json")
        hidden.owner.is_active = False
        hidden.owner.save()

        res = client_for(self.dept).get("/api/portfolio/ratings/?sort=high")
        self.assertEqual([r["stars"] for r in res.data["results"]], [5, 2])
        row = res.data["results"][0]
        self.assertEqual((row["item_title"], row["developer"]["id"], row["author"]["id"]), ("Do'kon", self.other.pk, self.dept.pk))
        self.assertEqual([r["stars"] for r in client_for(user).get("/api/portfolio/ratings/?sort=low").data["results"]], [2, 5])
        self.assertEqual(client_for(user).get("/api/portfolio/ratings/?q=sayt").data["count"], 1)
        self.assertEqual(client_for(user).get(f"/api/portfolio/ratings/?q={self.other.first_name}").data["count"], 1)
        mine = client_for(user).get("/api/portfolio/ratings/?mine=1").data["results"]
        self.assertEqual([r["author"]["id"] for r in mine], [user.pk])
        self.assertEqual(self.client_class().get("/api/portfolio/ratings/").status_code, 401)
