from datetime import timedelta
from unittest.mock import patch

from django.db import transaction
from django.test import TestCase, override_settings
from django.utils import timezone

from apps.accounts.models import Role
from apps.notifications.delivery import MAX_ATTEMPTS, deliver_one
from apps.notifications.models import Notification, TelegramDelivery
from apps.notifications.services import notify
from apps.panel.tests.factories import make_user


@override_settings(TELEGRAM_BOT_TOKEN="test", TELEGRAM_DELIVERY_MODE="outbox")
class OutboxTests(TestCase):
    def setUp(self):
        self.user = make_user(Role.DEVELOPER, telegram_chat_id="synthetic")

    def test_outbox_rolled_back_with_notification(self):
        with self.assertRaises(RuntimeError):
            with transaction.atomic():
                notify([self.user], "task_assigned", "Example")
                raise RuntimeError
        self.assertEqual(Notification.objects.count(), 0)
        self.assertEqual(TelegramDelivery.objects.count(), 0)

    def test_request_queues_without_external_call_then_worker_sends_once(self):
        with patch("apps.notifications.telegram.send_message", return_value=True) as send:
            notify([self.user, self.user], "task_assigned", "Example")
            send.assert_not_called()
            self.assertEqual(TelegramDelivery.objects.count(), 1)
            self.assertTrue(deliver_one())
            self.assertFalse(deliver_one())
            send.assert_called_once_with("synthetic", "Example")

    def test_failure_retries_after_delay_and_stops_at_limit(self):
        item = TelegramDelivery.objects.create(chat_id="synthetic", text="Example", available_at=timezone.now())
        with patch("apps.notifications.telegram.send_message", return_value=False):
            self.assertTrue(deliver_one())
            item.refresh_from_db()
            self.assertGreater(item.available_at, timezone.now())
            self.assertFalse(deliver_one())
            item.attempts = MAX_ATTEMPTS - 1
            item.available_at = timezone.now() - timedelta(seconds=1)
            item.save()
            self.assertTrue(deliver_one())
            item.refresh_from_db()
            self.assertIsNotNone(item.failed_at)

    def test_live_lease_skipped_and_expired_lease_recovered(self):
        item = TelegramDelivery.objects.create(chat_id="synthetic", text="Example", available_at=timezone.now(),
                                                lease_until=timezone.now() + timedelta(seconds=30))
        with patch("apps.notifications.telegram.send_message", return_value=True):
            self.assertFalse(deliver_one())
            item.lease_until = timezone.now() - timedelta(seconds=1)
            item.save()
            self.assertTrue(deliver_one())
