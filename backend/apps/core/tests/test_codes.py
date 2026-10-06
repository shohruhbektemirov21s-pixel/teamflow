from unittest import mock

from django.test import SimpleTestCase, TestCase

from apps.accounts.models import Role
from apps.core.codes import generate_unique_code, looks_like_code
from apps.panel.tests.factories import make_project, make_task, make_user


class LooksLikeCodeTests(SimpleTestCase):
    def test_nine_digits_with_spaces(self):
        self.assertTrue(looks_like_code(" 123456789 "))

    def test_wrong_length_or_letters(self):
        for text in ("12345678", "1234567890", "12345678a", "PRJ-12", "", None):
            with self.subTest(text=text):
                self.assertFalse(looks_like_code(text))


class GenerateUniqueCodeTests(TestCase):
    def test_retries_until_code_is_free(self):
        pm = make_user(Role.PM)
        taken = make_task(make_project(pm), pm).code
        with mock.patch("apps.core.codes._random_digits", side_effect=[taken, "000000001"]) as digits:
            self.assertEqual(generate_unique_code(), "000000001")
        self.assertEqual(digits.call_count, 2)
