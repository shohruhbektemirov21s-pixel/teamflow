"""Xizmat safari: ruxsat, sana va barcha vazifa biriktirish yo'llari."""
from datetime import timedelta
import json

from django.test import TestCase
from django.utils import timezone

from apps.accounts.models import Role
from apps.core.models import ActivityLog
from apps.panel.tests.factories import client_for, dates, make_project, make_user
from apps.tasks.models import Task


class BusinessTripTests(TestCase):
    def setUp(self):
        self.boss = make_user(Role.BOSS)
        self.pm = make_user(Role.PM)
        self.away = make_user(Role.DEVELOPER)
        self.other = make_user(Role.DEVELOPER)
        self.project = make_project(self.pm, self.away, self.other)
        self.url = f"/api/people/{self.away.pk}/business-trip/"
        self.return_date = timezone.localdate() + timedelta(days=3)

    def start_trip(self):
        response = client_for(self.boss).put(self.url, {"return_date": str(self.return_date)}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        return response

    def task_payload(self, assignee):
        return {"project": self.project.pk, "title": "Yangi vazifa", "assignee_ids": [assignee]}

    def test_only_boss_can_manage_active_employee_trip(self):
        self.assertEqual(client_for(self.pm).put(self.url, {"return_date": str(self.return_date)}, format="json").status_code, 403)
        self.assertEqual(client_for(self.pm).delete(self.url).status_code, 403)
        self.assertEqual(client_for(self.boss).put(self.url, {"return_date": str(timezone.localdate())}, format="json").status_code, 400)
        self.assertEqual(client_for(self.boss).put(f"/api/people/{self.boss.pk}/business-trip/", {"return_date": str(self.return_date)}, format="json").status_code, 404)
        self.assertEqual(client_for(self.boss).put(f"/api/people/{self.pm.pk}/business-trip/", {"return_date": str(self.return_date)}, format="json").status_code, 200)

    def test_status_visible_and_automatically_expires_on_return_date(self):
        response = self.start_trip()
        self.assertTrue(response.data["is_on_business_trip"])
        self.assertTrue(any(row["id"] == self.away.pk and row["is_on_business_trip"] for row in client_for(self.pm).get("/api/developers/").data))
        self.assertTrue(any(row["id"] == self.away.pk and row["is_on_business_trip"] for row in client_for(self.boss).get("/api/people/").data))
        self.assertTrue(ActivityLog.objects.filter(verb="business_trip_set", target_id=self.away.pk).exists())
        self.away.business_trip_return_date = timezone.localdate()
        self.away.save(update_fields=["business_trip_return_date"])
        self.assertFalse(client_for(self.pm).get(f"/api/people/{self.away.pk}/").data["is_on_business_trip"])
        self.assertEqual(client_for(self.pm).post("/api/tasks/", self.task_payload(self.away.pk), format="json").status_code, 201)

    def test_new_task_bulk_and_self_assignment_are_blocked(self):
        self.start_trip()
        pm = client_for(self.pm)
        self.assertEqual(pm.post("/api/tasks/", self.task_payload(self.away.pk), format="json").status_code, 400)
        self.assertEqual(client_for(self.away).post("/api/tasks/", self.task_payload(self.away.pk), format="json").status_code, 400)
        bulk = pm.post("/api/tasks/bulk/", {"project": self.project.pk, "tasks": [
            {"title": "Birinchi", "assignee_ids": [self.other.pk]},
            {"title": "Ikkinchi", "assignee_ids": [self.away.pk]},
        ]}, format="json")
        self.assertEqual(bulk.status_code, 400, bulk.data)
        self.assertEqual(Task.objects.count(), 0)

    def test_existing_task_can_remain_but_cannot_add_away_employee(self):
        pm = client_for(self.pm)
        existing = pm.post("/api/tasks/", self.task_payload(self.away.pk), format="json")
        self.assertEqual(existing.status_code, 201, existing.data)
        task_id = existing.data["id"]
        other = pm.post("/api/tasks/", self.task_payload(self.other.pk), format="json")
        self.assertEqual(other.status_code, 201, other.data)
        old_subtask = pm.post(f"/api/tasks/{task_id}/subtasks/", {"title": "Mavjud", "assignee_ids": [self.away.pk]}, format="json")
        self.assertEqual(old_subtask.status_code, 201, old_subtask.data)
        old_subtask_id = old_subtask.data["subtasks"][0]["id"]
        self.start_trip()
        self.assertEqual(pm.patch(f"/api/tasks/{task_id}/", {"title": "Tahrir", "assignee_ids": [self.away.pk],
            "subtasks": [{"id": old_subtask_id, "title": "Mavjud tahrir", "assignee_ids": [self.away.pk]}]}, format="json").status_code, 200)
        self.assertEqual(pm.patch(f"/api/tasks/{task_id}/", {"subtasks": [
            {"id": old_subtask_id, "title": "Mavjud", "assignee_ids": [self.away.pk]},
            {"title": "Yangi", "assignee_ids": [self.away.pk]},
        ]}, format="json").status_code, 400)
        self.assertEqual(pm.put(f"/api/tasks/{other.data['id']}/assignees/", {"assignee_ids": [self.other.pk, self.away.pk]}, format="json").status_code, 400)
        self.assertEqual(pm.post(f"/api/tasks/{task_id}/subtasks/", {"title": "Yangi", "assignee_ids": [self.away.pk]}, format="json").status_code, 400)
        subtask = pm.post(f"/api/tasks/{task_id}/subtasks/", {"title": "Ruxsat", "assignee_ids": [self.other.pk]}, format="json")
        self.assertEqual(subtask.status_code, 201, subtask.data)
        subtask_id = next(item["id"] for item in subtask.data["subtasks"] if item["title"] == "Ruxsat")
        self.assertEqual(pm.patch(f"/api/tasks/{task_id}/subtasks/{subtask_id}/", {"assignee_ids": [self.other.pk, self.away.pk]}, format="json").status_code, 400)

    def test_boss_can_end_trip_early(self):
        self.start_trip()
        response = client_for(self.boss).delete(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["is_on_business_trip"])
        self.assertIsNone(response.data["business_trip_return_date"])
        self.assertEqual(client_for(self.pm).post("/api/tasks/", self.task_payload(self.away.pk), format="json").status_code, 201)

    def test_project_setup_with_away_assignee_rolls_back(self):
        self.start_trip()
        response = client_for(self.pm).post("/api/projects/setup/", {
            "code": "TRIP-SETUP", "name": "Safar nazorati", **dates(),
            "member_ids": json.dumps([self.away.pk, self.other.pk]),
            "tasks": json.dumps([{"title": "Ruxsat", "assignee_id": self.other.pk},
                                 {"title": "Taqiqlangan", "assignee_id": self.away.pk}]),
        }, format="multipart")
        self.assertEqual(response.status_code, 400, response.data)
        self.assertFalse(Task.objects.exists())
