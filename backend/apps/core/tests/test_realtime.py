from unittest import mock

from asgiref.sync import async_to_sync, sync_to_async
from channels.layers import get_channel_layer
from channels.testing import WebsocketCommunicator
from django.contrib.auth.models import AnonymousUser
from django.db import transaction
from django.test import SimpleTestCase, TestCase

from apps.accounts.models import Role
from apps.chat.services import send_message
from apps.core import realtime
from apps.core.consumers import EventsConsumer
from apps.notifications.models import Notification
from apps.notifications.services import notify
from apps.panel.tests.factories import make_user
from config.asgi import application


class PublishTests(TestCase):
    def setUp(self):
        self.dev = make_user(Role.DEVELOPER)
        self.pm = make_user(Role.PM)

    def test_sent_to_each_user_group_after_commit(self):
        # Hammasi bitta event loop'da: Redis pub/sub qatlami kanalni faqat o'z loop'ida taniydi
        def publish_and_commit():
            with self.captureOnCommitCallbacks(execute=True) as callbacks:
                realtime.publish([self.dev.pk, self.dev.pk, None], {"type": "notification"})
            return callbacks

        async def scenario():
            layer = get_channel_layer()
            channel = await layer.new_channel()  # ochiq WebSocket o'rnida
            await layer.group_add(realtime.user_group(self.dev.pk), channel)
            callbacks = await sync_to_async(publish_and_commit)()
            message = await layer.receive(channel)
            await layer.group_discard(realtime.user_group(self.dev.pk), channel)
            return callbacks, message["payload"]

        callbacks, payload = async_to_sync(scenario)()
        self.assertEqual(len(callbacks), 1)
        self.assertEqual(payload, {"type": "notification"})

    def test_rolled_back_transaction_sends_nothing(self):
        with self.captureOnCommitCallbacks(execute=False) as callbacks:
            try:
                with transaction.atomic():
                    realtime.publish([self.dev.pk], {"type": "notification"})
                    raise RuntimeError
            except RuntimeError:
                pass
        self.assertEqual(callbacks, [])

    def test_layer_failure_does_not_break_the_action(self):
        layer = get_channel_layer()
        with mock.patch.object(layer, "group_send", side_effect=ConnectionError("redis yo'q")), \
                self.assertLogs("apps.core.realtime", "WARNING"):
            with self.captureOnCommitCallbacks(execute=True):
                realtime.publish([self.dev.pk], {"type": "notification"})

    def test_notify_publishes_to_recipients_only(self):
        with mock.patch.object(realtime, "_send") as send, self.captureOnCommitCallbacks(execute=True):
            notify([self.dev, self.pm], Notification.Kind.TASK_ASSIGNED, "Vazifa", exclude=self.pm)
        send.assert_called_once_with([self.dev.pk], {"type": "notification"})
        self.assertEqual(Notification.objects.get().recipient, self.dev)

    def test_chat_message_publishes_to_both_sides_with_partner_id(self):
        with mock.patch.object(realtime, "_send") as send, self.captureOnCommitCallbacks(execute=True):
            send_message(self.dev, self.pm, "Salom")
        send.assert_has_calls([
            mock.call([self.pm.pk], {"type": "chat", "partner": self.dev.pk}),
            mock.call([self.dev.pk], {"type": "chat", "partner": self.pm.pk}),
        ])


class EventsConsumerTests(SimpleTestCase):
    async def _connect(self, user):
        communicator = WebsocketCommunicator(EventsConsumer.as_asgi(), "/ws/events/")
        communicator.scope["user"] = user
        return communicator, await communicator.connect()

    async def test_anonymous_is_rejected(self):
        communicator, (connected, code) = await self._connect(AnonymousUser())
        self.assertFalse(connected)
        self.assertEqual(code, 4401)

    async def test_user_receives_only_own_events(self):
        user = mock.Mock(pk=7, is_authenticated=True, is_active=True)
        communicator, (connected, _) = await self._connect(user)
        self.assertTrue(connected)
        layer = get_channel_layer()
        await layer.group_send(realtime.user_group(8), {"type": "event", "payload": {"type": "notification"}})
        self.assertTrue(await communicator.receive_nothing(timeout=0.1))
        await layer.group_send(realtime.user_group(7), {"type": "event", "payload": {"type": "notification"}})
        self.assertEqual(await communicator.receive_json_from(), {"type": "notification"})
        await communicator.disconnect()

    async def test_foreign_origin_is_rejected(self):
        communicator = WebsocketCommunicator(application, "/ws/events/", headers=[(b"origin", b"https://evil.example")])
        connected, _ = await communicator.connect()
        self.assertFalse(connected)
