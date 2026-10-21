from unittest import mock

import requests
from django.db import transaction
from django.test import TestCase, override_settings

from apps.accounts.models import Role
from apps.notifications import telegram
from apps.notifications.models import Notification
from apps.notifications.services import notify
from apps.panel.tests.factories import make_user

K = Notification.Kind


class SyncThread:
    """Testda fon oqimi o'rniga: `start()` maqsad funksiyani darhol chaqiradi."""

    def __init__(self, target, args=(), daemon=None):
        self.target, self.args = target, args

    def start(self):
        self.target(*self.args)


@override_settings(TELEGRAM_BOT_TOKEN="test-token", TELEGRAM_DELIVERY_MODE="thread")
class NotifyTelegramTests(TestCase):
    def setUp(self):
        self.linked = make_user(Role.DEVELOPER, telegram_chat_id="111")
        self.unlinked = make_user(Role.DEVELOPER)

    def test_sent_only_after_commit_and_only_to_linked_users(self):
        with mock.patch.object(telegram, "send_many") as send_many, \
                mock.patch("apps.notifications.services.threading.Thread", SyncThread):
            with self.captureOnCommitCallbacks(execute=True) as callbacks:
                notify([self.linked, self.unlinked], K.TASK_ASSIGNED, "Vazifa berildi")
                send_many.assert_not_called()  # tranzaksiya tugamaguncha yuborilmaydi
            self.assertEqual(len(callbacks), 2)  # cache invalidation + Telegram delivery
        send_many.assert_called_once_with([("111", "Vazifa berildi")])
        self.assertEqual(Notification.objects.count(), 2)

    def test_rolled_back_transaction_sends_nothing(self):
        with mock.patch.object(telegram, "send_many") as send_many:
            with self.captureOnCommitCallbacks(execute=False) as callbacks:
                try:
                    with transaction.atomic():
                        notify([self.linked], K.TASK_ASSIGNED, "Bekor bo'ladi")
                        raise RuntimeError
                except RuntimeError:
                    pass
            self.assertEqual(callbacks, [])
        send_many.assert_not_called()

    @override_settings(TELEGRAM_BOT_TOKEN="")
    def test_no_token_no_callback(self):
        with self.captureOnCommitCallbacks(execute=True):
            notify([self.linked], K.TASK_ASSIGNED, "Xabar")
        self.assertEqual(Notification.objects.count(), 1)

    def test_send_message_swallows_network_errors_and_uses_timeout(self):
        with mock.patch.object(telegram.requests, "post", side_effect=requests.ConnectionError("tarmoq yo'q")) as post, \
                self.assertLogs("apps.notifications.telegram", "WARNING"):
            telegram.send_message("111", "Salom")  # istisno chiqmasligi kerak
        self.assertEqual(post.call_args.kwargs["timeout"], telegram.TIMEOUT)


class LinkChatTests(TestCase):
    def test_links_active_user_by_username_stored_with_at_sign(self):
        user = make_user(Role.DEVELOPER, telegram_username="@Jasur_dev")
        reply = telegram.link_chat("jasur_dev", 555)
        user.refresh_from_db()
        self.assertEqual(user.telegram_chat_id, "555")
        self.assertIn(user.full_name, reply)

    def test_inactive_unknown_duplicate_and_missing_username_are_not_linked(self):
        pending = make_user(Role.DEVELOPER, active=False, telegram_username="@kutyapti")
        make_user(Role.DEVELOPER, telegram_username="@ikki")
        make_user(Role.PM, telegram_username="@ikki")
        for username in ("kutyapti", "yoq_odam", "ikki", None):
            with self.subTest(username=username):
                telegram.link_chat(username, 777)
        pending.refresh_from_db()
        self.assertEqual(pending.telegram_chat_id, "")
        self.assertFalse(type(pending).objects.filter(telegram_chat_id="777").exists())

    def test_handle_update_reacts_only_to_start(self):
        make_user(Role.DEVELOPER, telegram_username="@ali")
        start = {"update_id": 1, "message": {"text": "/start", "chat": {"id": 9}, "from": {"username": "ali"}}}
        other = {"update_id": 2, "message": {"text": "salom", "chat": {"id": 9}, "from": {"username": "ali"}}}
        self.assertEqual(telegram.handle_update(start)[0], 9)
        self.assertIsNone(telegram.handle_update(other))
        self.assertIsNone(telegram.handle_update({"update_id": 3}))
