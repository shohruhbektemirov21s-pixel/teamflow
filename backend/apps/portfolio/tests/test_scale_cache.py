from unittest.mock import patch

from django.core.cache import cache
from django.db import connection
from django.test import TestCase, override_settings
from django.test.utils import CaptureQueriesContext

from apps.accounts.models import Role
from apps.panel.tests.factories import client_for, make_user, today
from apps.projects.models import Project, ProjectMember

from ..models import Follow, PortfolioItem


@override_settings(PORTFOLIO_RANKING_CACHE_SECONDS=60)
class PortfolioScaleTests(TestCase):
    def setUp(self):
        cache.clear()
        self.pm = make_user(Role.PM)
        self.developer = make_user(Role.DEVELOPER)
        self.viewer = make_user(Role.DEPARTMENT)
        self.project = Project.objects.create(
            code="PORT-SCALE-1", name="Portal", start_date=today(), end_date=today(), created_by=self.pm
        )

    def tearDown(self):
        cache.clear()

    def _row(self, response):
        return next(row for row in response.data["results"] if row["id"] == self.developer.pk)

    def test_project_membership_creates_item_before_a_portfolio_read(self):
        ProjectMember.objects.create(project=self.project, developer=self.developer)
        self.assertTrue(PortfolioItem.objects.filter(owner=self.developer, project=self.project).exists())

        with CaptureQueriesContext(connection) as queries:
            response = client_for(self.viewer).get(f"/api/portfolio/{self.developer.pk}/")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(any("INSERT" in query["sql"].upper() for query in queries.captured_queries))

    def test_default_ranking_cache_keeps_follow_state_specific_to_the_viewer(self):
        ProjectMember.objects.create(project=self.project, developer=self.developer)
        first = client_for(self.viewer).get("/api/portfolio/")
        self.assertFalse(self._row(first)["is_following"])

        Follow.objects.create(follower=self.viewer, developer=self.developer)
        with patch("apps.portfolio.api.developers_with_stats", side_effect=AssertionError("rank SQL qayta ishlamasin")):
            second = client_for(self.viewer).get("/api/portfolio/")
        self.assertTrue(self._row(second)["is_following"])

    def test_review_invalidates_the_cached_ranking(self):
        item = PortfolioItem.objects.create(owner=self.developer, title="Shaxsiy loyiha")
        first = client_for(self.viewer).get("/api/portfolio/")
        self.assertIsNone(self._row(first)["rating"])

        with self.captureOnCommitCallbacks(execute=True) as callbacks:
            review = client_for(self.viewer).post(
                f"/api/portfolio/items/{item.pk}/reviews/", {"stars": 5, "text": "A'lo"}, format="json"
            )
        self.assertTrue(callbacks, "kesh tranzaksiya tasdiqlangach tozalanadi")
        self.assertEqual(review.status_code, 200)
        second = client_for(self.viewer).get("/api/portfolio/")
        self.assertEqual(self._row(second)["rating"], 5.0)

    def test_hot_portfolio_feeds_declare_their_compound_indexes(self):
        from apps.portfolio.models import PortfolioReview

        self.assertIn("portfolio_owner_feed_idx", {index.name for index in PortfolioItem._meta.indexes})
        self.assertIn("portfolio_review_feed_idx", {index.name for index in PortfolioReview._meta.indexes})
