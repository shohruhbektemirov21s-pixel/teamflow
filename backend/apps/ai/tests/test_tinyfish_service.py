from unittest import mock

import requests
from django.test import SimpleTestCase, override_settings

from apps.ai.services.tinyfish_service import (
    TinyFishService,
    TinyFishUnavailable,
    validate_public_url,
)


@override_settings(TINYFISH_API_KEY="test-key", TINYFISH_HTTP_RETRIES=2, TINYFISH_TIMEOUT_SECONDS=7)
class TinyFishServiceTests(SimpleTestCase):
    def setUp(self):
        self.service = TinyFishService()

    @mock.patch("apps.ai.services.tinyfish_service.requests.post")
    def test_starts_async_automation_with_structured_output(self, post):
        post.return_value.json.return_value = {"run_id": "run-123", "error": None}
        post.return_value.raise_for_status.return_value = None

        run_id = self.service.navigate("https://example.com", "Narxlar sahifasini toping")

        self.assertEqual(run_id, "run-123")
        self.assertEqual(post.call_args.args[0], "https://agent.tinyfish.ai/v1/automation/run-async")
        self.assertEqual(post.call_args.kwargs["headers"]["X-API-Key"], "test-key")
        self.assertEqual(post.call_args.kwargs["timeout"], 7)
        self.assertEqual(post.call_args.kwargs["json"]["url"], "https://example.com/")
        self.assertIn("output_schema", post.call_args.kwargs["json"])

    @mock.patch("apps.ai.services.tinyfish_service.requests.get", side_effect=requests.Timeout)
    @mock.patch("apps.ai.services.tinyfish_service.time.sleep")
    def test_retries_timeout_when_polling_status(self, sleep, get):
        with self.assertRaises(TinyFishUnavailable):
            self.service.get_task_status("automation", "run-123")

        self.assertEqual(get.call_count, 3)
        self.assertEqual(sleep.call_count, 2)

    @mock.patch("apps.ai.services.tinyfish_service.requests.post")
    def test_starts_research_when_url_is_not_provided(self, post):
        post.return_value.json.return_value = {"research_run_id": "research-123", "error": None}
        post.return_value.raise_for_status.return_value = None

        run_id = self.service.research("Toshkentdagi coworking joylarini toping")

        self.assertEqual(run_id, "research-123")
        self.assertEqual(post.call_args.args[0], "https://agent.tinyfish.ai/v1/automation/run-research-async")

    @mock.patch("apps.ai.services.tinyfish_service.socket.getaddrinfo")
    def test_rejects_private_or_local_urls_before_calling_tinyfish(self, getaddrinfo):
        for url in ("http://127.0.0.1/", "http://localhost/", "http://169.254.169.254/", "file:///etc/passwd"):
            with self.subTest(url=url):
                with self.assertRaises(ValueError):
                    validate_public_url(url)
        getaddrinfo.assert_not_called()
