from django.test import TestCase

from apps.accounts.models import Role
from apps.panel.tests.factories import client_for, make_user
from apps.chat.models import ChatMessage


class ChatApiTests(TestCase):
    def setUp(self):
        self.me = make_user(Role.DEVELOPER)
        self.partner = make_user(Role.PM)
        self.other = make_user(Role.DEVELOPER)
        self.client = client_for(self.me)

    def test_messages_requires_a_valid_partner(self):
        for partner in (None, "not-a-number", "999999"):
            with self.subTest(partner=partner):
                suffix = "" if partner is None else f"?partner={partner}"
                response = self.client.get(f"/api/chat/messages/{suffix}")
                self.assertEqual(response.status_code, 400)

    def test_send_rejects_self_inactive_partner_and_blank_text(self):
        inactive = make_user(Role.DEVELOPER, active=False)
        cases = (
            {"partner": self.me.pk, "text": "Menga xabar"},
            {"partner": inactive.pk, "text": "Xabar"},
            {"partner": self.partner.pk, "text": "   "},
        )
        for payload in cases:
            with self.subTest(payload=payload):
                response = self.client.post("/api/chat/send/", payload, format="json")
                self.assertEqual(response.status_code, 400)
        self.assertEqual(ChatMessage.objects.count(), 0)

    def test_conversations_show_latest_message_and_grouped_unread_count(self):
        ChatMessage.objects.create(author=self.partner, recipient=self.me, text="Birinchi")
        ChatMessage.objects.create(author=self.partner, recipient=self.me, text="Ikkinchi")
        latest = ChatMessage.objects.create(author=self.me, recipient=self.partner, text="Javob")
        ChatMessage.objects.create(author=self.other, recipient=self.me, text="Boshqa suhbat")

        response = self.client.get("/api/chat/conversations/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            sum(item["partner"]["id"] == self.partner.pk for item in response.data),
            1,
        )
        partner_row = next(item for item in response.data if item["partner"]["id"] == self.partner.pk)
        self.assertEqual(partner_row["last_message"], latest.text)
        self.assertTrue(partner_row["outgoing"])
        self.assertEqual(partner_row["unread_count"], 2)

    def test_opening_messages_marks_only_that_partner_messages_read(self):
        incoming = ChatMessage.objects.create(author=self.partner, recipient=self.me, text="Yangi")
        untouched = ChatMessage.objects.create(author=self.other, recipient=self.me, text="Boshqa")

        response = self.client.get(f"/api/chat/messages/?partner={self.partner.pk}")

        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["id"] for item in response.data], [incoming.pk])
        incoming.refresh_from_db()
        untouched.refresh_from_db()
        self.assertTrue(incoming.is_read)
        self.assertFalse(untouched.is_read)
