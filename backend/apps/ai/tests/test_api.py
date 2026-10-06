from unittest import mock

from django.core.cache import cache
from django.test import TestCase

from apps.accounts.models import Role
from apps.ai.models import WebAgentRun
from apps.ai.services.tinyfish_service import ProviderTask, TinyFishUnavailable
from apps.panel.tests.factories import client_for, make_user


class WebAgentApiTests(TestCase):
    def setUp(self):
        cache.clear()
        self.pm = make_user(Role.PM)
        self.client = client_for(self.pm)

    @mock.patch("apps.ai.services.web_agent.TinyFishService.navigate", return_value="run-123")
    @mock.patch("apps.ai.services.web_agent.validate_public_url", return_value="https://example.com/")
    def test_manager_starts_url_automation_and_run_is_saved(self, validate_url, navigate):
        response = self.client.post(
            "/api/ai/web-agent/",
            {"task": "Narxlarni toping", "url": "https://example.com"},
            format="json",
        )

        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.data["status"], "pending")
        self.assertEqual(response.data["provider_run_id"], "run-123")
        run = WebAgentRun.objects.get(pk=response.data["id"])
        self.assertEqual(run.created_by, self.pm)
        self.assertEqual(run.provider_kind, WebAgentRun.ProviderKind.AUTOMATION)
        validate_url.assert_called_once_with("https://example.com")
        navigate.assert_called_once_with("https://example.com/", "Narxlarni toping")

    @mock.patch("apps.ai.services.web_agent.TinyFishService.research", return_value="research-123")
    def test_manager_starts_research_when_url_is_null(self, research):
        response = self.client.post(
            "/api/ai/web-agent/",
            {"task": "Toshkentdagi eng yaxshi 5 ta coworking joyini top", "url": None},
            format="json",
        )

        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.data["status"], "pending")
        self.assertEqual(WebAgentRun.objects.get(pk=response.data["id"]).provider_kind, WebAgentRun.ProviderKind.RESEARCH)
        research.assert_called_once()

    @mock.patch(
        "apps.ai.services.web_agent.TinyFishService.get_task_status",
        return_value=ProviderTask(
            status="completed",
            result={"summary": "5 ta joy topildi", "citations": ["https://example.com"]},
            error=None,
        ),
    )
    def test_owner_can_refresh_a_completed_task_status(self, get_task_status):
        run = WebAgentRun.objects.create(
            created_by=self.pm,
            task="Coworking toping",
            provider_kind=WebAgentRun.ProviderKind.RESEARCH,
            provider_run_id="research-123",
        )

        response = self.client.get(f"/api/ai/web-agent/{run.pk}/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["status"], "completed")
        self.assertEqual(response.data["result"]["summary"], "5 ta joy topildi")
        run.refresh_from_db()
        self.assertEqual(run.status, WebAgentRun.Status.COMPLETED)
        get_task_status.assert_called_once_with(WebAgentRun.ProviderKind.RESEARCH, "research-123")

    def test_developer_cannot_start_web_agent(self):
        response = client_for(make_user(Role.DEVELOPER)).post(
            "/api/ai/web-agent/", {"task": "Qidiring", "url": None}, format="json"
        )
        self.assertEqual(response.status_code, 403)

    def test_invalid_internal_url_is_rejected(self):
        response = self.client.post(
            "/api/ai/web-agent/", {"task": "Tekshiring", "url": "http://127.0.0.1:8020"}, format="json"
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("url", response.data["fields"])

    @mock.patch("apps.ai.services.web_agent.TinyFishService.research", side_effect=TinyFishUnavailable("Timeout"))
    def test_provider_timeout_returns_clear_json_error_without_crashing(self, research):
        response = self.client.post("/api/ai/web-agent/", {"task": "Qidiring", "url": None}, format="json")

        self.assertEqual(response.status_code, 503)
        self.assertIn("detail", response.data)
        research.assert_called_once_with("Qidiring")
