from django.core.exceptions import ValidationError
from django.test import TestCase

from apps.accounts.models import Role, User


class UserModelTests(TestCase):
    def test_department_requires_name(self):
        user = User(username="b1", role=Role.DEPARTMENT)
        with self.assertRaises(ValidationError):
            user.clean()

    def test_department_name_only_for_department(self):
        user = User(username="d1", role=Role.DEVELOPER, department_name="IT")
        with self.assertRaises(ValidationError):
            user.clean()

    def test_manager_flag(self):
        self.assertTrue(User(role=Role.PM).is_manager)
        self.assertTrue(User(role=Role.BOSS).is_manager)
        self.assertFalse(User(role=Role.DEVELOPER).is_manager)
        self.assertFalse(User(role=Role.DEPARTMENT).is_manager)
