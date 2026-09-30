from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from apps.accounts.models import User, Role
from apps.suggestions.models import Suggestion, SuggestionVote

class SuggestionApiTests(TestCase):
    def test_generic_update_cannot_bypass_boss_decision(self):
        suggestion = Suggestion.objects.create(title="Original", body="Text", author=self.pm)
        self.client.force_login(self.dev)
        for method in (self.client.patch, self.client.put):
            response = method(reverse("suggestion-detail", args=[suggestion.pk]),
                              {"title": "Changed", "body": "Changed", "status": "accepted", "boss_note": "Forged"},
                              content_type="application/json")
            self.assertEqual(response.status_code, 405)
        suggestion.refresh_from_db()
        self.assertEqual(suggestion.status, "pending")
        self.assertEqual(suggestion.title, "Original")

    def setUp(self):
        self.dev = User.objects.create_user(username="dev1", password="testpass123", role=Role.DEVELOPER, is_active=True, first_name="Dev", last_name="One")
        self.boss = User.objects.create_user(username="boss1", password="testpass123", role=Role.BOSS, is_active=True, first_name="Boss", last_name="One")
        self.pm = User.objects.create_user(username="pm1", password="testpass123", role=Role.PM, is_active=True, first_name="Pm", last_name="One")

    def test_create_suggestion(self):
        self.client.login(username="dev1", password="testpass123")
        url = reverse("suggestion-list")
        data = {
            "title": "New feature",
            "body": "Let's add dark mode",
            "is_anonymous": False
        }
        res = self.client.post(url, data, content_type="application/json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Suggestion.objects.count(), 1)
        s = Suggestion.objects.first()
        self.assertEqual(s.author, self.dev)
        self.assertFalse(s.is_anonymous)

    def test_create_anonymous(self):
        self.client.login(username="dev1", password="testpass123")
        url = reverse("suggestion-list")
        data = {
            "title": "Bad food",
            "body": "Coffee is bad",
            "is_anonymous": True
        }
        res = self.client.post(url, data, content_type="application/json")
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Suggestion.objects.count(), 1)
        s = Suggestion.objects.first()
        self.assertIsNone(s.author)
        self.assertTrue(s.is_anonymous)

    def test_vote(self):
        s = Suggestion.objects.create(title="T1", body="B1", author=self.pm)
        
        self.client.login(username="dev1", password="testpass123")
        url = reverse("suggestion-vote", kwargs={"pk": s.pk})
        data = {"kind": SuggestionVote.Kind.FOR}
        res = self.client.post(url, data, content_type="application/json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        
        self.assertEqual(SuggestionVote.objects.count(), 1)
        vote = SuggestionVote.objects.first()
        self.assertEqual(vote.voter, self.dev)
        self.assertEqual(vote.kind, SuggestionVote.Kind.FOR)

    def test_boss_decide(self):
        s = Suggestion.objects.create(title="T1", body="B1", author=self.dev)
        
        self.client.login(username="boss1", password="testpass123")
        url = reverse("suggestion-decide", kwargs={"pk": s.pk})
        data = {
            "status": Suggestion.Status.ACCEPTED,
            "boss_note": "Good idea"
        }
        res = self.client.post(url, data, content_type="application/json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        
        s.refresh_from_db()
        self.assertEqual(s.status, Suggestion.Status.ACCEPTED)
        self.assertEqual(s.decided_by, self.boss)
        self.assertEqual(s.boss_note, "Good idea")

    def test_non_boss_cannot_decide(self):
        s = Suggestion.objects.create(title="T1", body="B1", author=self.dev)
        
        self.client.login(username="pm1", password="testpass123")
        url = reverse("suggestion-decide", kwargs={"pk": s.pk})
        data = {
            "status": Suggestion.Status.ACCEPTED,
            "boss_note": "Good idea"
        }
        res = self.client.post(url, data, content_type="application/json")
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        
        s.refresh_from_db()
        self.assertEqual(s.status, Suggestion.Status.PENDING)
        self.assertIsNone(s.decided_by)

    def test_decided_suggestion_cannot_be_decided_again(self):
        s = Suggestion.objects.create(title="T1", body="B1", author=self.dev, status=Suggestion.Status.REJECTED)

        self.client.login(username="boss1", password="testpass123")
        url = reverse("suggestion-decide", kwargs={"pk": s.pk})
        res = self.client.post(url, {"status": Suggestion.Status.ACCEPTED}, content_type="application/json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

        s.refresh_from_db()
        self.assertEqual(s.status, Suggestion.Status.REJECTED)

    def test_author_cannot_vote_or_delete_others(self):
        s = Suggestion.objects.create(title="T1", body="B1", author=self.dev)

        self.client.login(username=self.dev.username, password="testpass123")
        res = self.client.post(reverse("suggestion-vote", kwargs={"pk": s.pk}), {"kind": "for"}, content_type="application/json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

        self.client.login(username="pm1", password="testpass123")
        res = self.client.delete(reverse("suggestion-detail", kwargs={"pk": s.pk}))
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Suggestion.objects.filter(pk=s.pk).exists())


class SuggestionListOrderTests(TestCase):
    """Ro'yxat Count bilan annotatsiya qilinadi — tartib aniq berilmasa sahifalashda yozuvlar takrorlanishi mumkin."""

    def test_list_is_newest_first_across_pages(self):
        from datetime import timedelta

        from django.utils import timezone

        dev = User.objects.create_user(username="dev_order", password="testpass123", role=Role.DEVELOPER, is_active=True)
        now = timezone.now()
        ids = []
        for i in range(55):  # PAGE_SIZE = 50 — ikki sahifa
            s = Suggestion.objects.create(title=f"S{i}", body="Matn", author=dev)
            Suggestion.objects.filter(pk=s.pk).update(created_at=now + timedelta(minutes=i))  # id tartibiga teskari
            ids.append(s.pk)
        self.client.force_login(dev)
        page1 = self.client.get(reverse("suggestion-list")).json()
        page2 = self.client.get(reverse("suggestion-list") + "?page=2").json()
        self.assertEqual([s["id"] for s in page1["results"] + page2["results"]], ids[::-1])
