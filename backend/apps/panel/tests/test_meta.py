from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import Role
from apps.panel.tests.factories import client_for, make_user


class MetaTests(TestCase):
    def test_anonymous_gets_lists_without_moves(self):
        r = APIClient().get("/api/meta/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual([x["value"] for x in r.data["register_roles"]], ["pm", "developer", "department"])
        self.assertEqual([x["value"] for x in r.data["task_statuses"]], ["control", "in_progress", "in_review", "done"])
        self.assertEqual(r.data["task_moves"], [])

    def test_moves_follow_workflow_for_role(self):
        dev = client_for(make_user(Role.DEVELOPER)).get("/api/meta/").data["task_moves"]
        self.assertIn({"from": "control", "to": "in_progress"}, dev)
        self.assertNotIn({"from": "in_review", "to": "done"}, dev)
        pm = client_for(make_user(Role.PM)).get("/api/meta/").data["task_moves"]
        self.assertIn({"from": "in_review", "to": "done"}, pm)
