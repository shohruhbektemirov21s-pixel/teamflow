from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import TestCase, override_settings

from apps.accounts.models import User


class ScaleSeedSafetyTests(TestCase):
    @override_settings(SCALE_TEST_MODE=False)
    def test_seeding_requires_explicit_test_mode(self):
        with self.assertRaisesMessage(CommandError, "isolated PostgreSQL database"):
            call_command("seed_scale", output="never-created.json")
        self.assertEqual(User.objects.count(), 0)

    @override_settings(SCALE_TEST_MODE=True)
    def test_test_mode_does_not_authorize_an_unrelated_database(self):
        # Neither SQLite nor the functional test database is teamflow_scale.
        with self.assertRaisesMessage(CommandError, "isolated PostgreSQL database"):
            call_command("seed_scale", output="never-created.json")
        self.assertEqual(User.objects.count(), 0)
