from unittest.mock import patch

from django.core.cache import cache
from django.test import TestCase, override_settings

from apps.accounts.models import Role
from apps.notifications.models import Notification
from apps.notifications.services import notify, unread_count_cache_key
from apps.panel.tests.factories import client_for, make_user


@override_settings(NOTIFICATION_UNREAD_CACHE_SECONDS=60)
class UnreadCountCacheTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user = make_user(Role.DEVELOPER)
        self.client = client_for(self.user)

    def tearDown(self):
        cache.clear()

    def test_cached_count_avoids_a_second_database_count(self):
        Notification.objects.create(recipient=self.user, kind=Notification.Kind.COMMENT, message="Yangi izoh")

        self.assertEqual(self.client.get("/api/notifications/unread_count/").data, {"count": 1})
        self.assertEqual(cache.get(unread_count_cache_key(self.user.pk)), 1)
        with patch("apps.notifications.api.Notification.objects.filter", side_effect=AssertionError("DB count ishlamasin")):
            self.assertEqual(self.client.get("/api/notifications/unread_count/").data, {"count": 1})

    def test_notification_and_read_operations_invalidate_the_cached_count(self):
        self.assertEqual(self.client.get("/api/notifications/unread_count/").data, {"count": 0})
        self.assertEqual(cache.get(unread_count_cache_key(self.user.pk)), 0)

        with self.captureOnCommitCallbacks(execute=True):
            notify([self.user], Notification.Kind.COMMENT, "Yangi izoh")
        self.assertIsNone(cache.get(unread_count_cache_key(self.user.pk)))
        self.assertEqual(self.client.get("/api/notifications/unread_count/").data, {"count": 1})

        notice = Notification.objects.get(recipient=self.user)
        self.client.post(f"/api/notifications/{notice.pk}/read/")
        self.assertIsNone(cache.get(unread_count_cache_key(self.user.pk)))
        self.assertEqual(self.client.get("/api/notifications/unread_count/").data, {"count": 0})
