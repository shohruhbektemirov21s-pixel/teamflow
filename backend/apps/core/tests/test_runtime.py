from pathlib import Path
from unittest.mock import patch

from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase, TestCase

from config.runtime import cache_config, database_config


class RuntimeConfigTests(SimpleTestCase):
    def test_production_requires_postgres_and_shared_cache(self):
        for build in (lambda: database_config("", Path("."), debug=False), lambda: cache_config("", debug=False)):
            with self.assertRaises(ImproperlyConfigured):
                build()

    def test_postgres_url_credentials_and_tls_are_parsed(self):
        value = database_config("postgresql://user:p%40ss@db:5433/teamflow?sslmode=require", Path("."), debug=False)
        self.assertEqual(value["PASSWORD"], "p@ss")
        self.assertEqual(value["PORT"], 5433)
        self.assertEqual(value["OPTIONS"]["sslmode"], "require")
        self.assertTrue(value["CONN_HEALTH_CHECKS"])

    def test_unsupported_database_and_cache_fail_closed(self):
        with self.assertRaises(ImproperlyConfigured):
            database_config("sqlite:///production.db", Path("."), debug=False)
        with self.assertRaises(ImproperlyConfigured):
            cache_config("http://cache", debug=False)


class HealthTests(TestCase):
    def test_health_probes(self):
        self.assertEqual(self.client.get("/healthz/live/").status_code, 200)
        self.assertEqual(self.client.get("/healthz/ready/").status_code, 200)

    def test_unavailable_dependency_is_503_without_details(self):
        with patch("apps.core.health.cache.get", side_effect=RuntimeError("private credentials")):
            response = self.client.get("/healthz/ready/")
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json(), {"status": "unavailable"})
