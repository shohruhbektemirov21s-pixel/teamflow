"""Boshliq/PM ijrochi bo'lmay "Tekshiruvga yuborish" bossa — ijrochi(lar) tasdig'i talab qilinadi
(foydalanuvchi so'rovi, 2026-10-05): vazifa ijrochisi to'g'ridan-to'g'ri yuboradi, menejer esa avval
ijrochidan ruxsat so'raydi."""
from django.test import TestCase

from apps.accounts.models import Role
from apps.notifications.models import Notification
from apps.panel.tests.factories import client_for, docx, make_project, make_task, make_user
from apps.tasks.models import Task


class TaskSubmitAckTests(TestCase):
    def setUp(self):
        self.pm = make_user(Role.PM)
        self.dev1 = make_user(Role.DEVELOPER)
        self.dev2 = make_user(Role.DEVELOPER)
        self.project = make_project(self.pm, self.dev1, self.dev2)
        self.task = make_task(self.project, self.pm, self.dev1, self.dev2, status=Task.Status.IN_PROGRESS)

    def submit(self, user, note="Tayyor", files=None):
        data = {"note": note}
        if files:
            return client_for(user).post(f"/api/tasks/{self.task.pk}/submit/", {**data, "files": files}, format="multipart")
        return client_for(user).post(f"/api/tasks/{self.task.pk}/submit/", data, format="json")

    def ack(self, dev, confirmed, reason=""):
        return client_for(dev).post(
            f"/api/tasks/{self.task.pk}/submit-ack/", {"confirmed": confirmed, "reason": reason}, format="json"
        )

    def test_assignee_submits_directly_without_ack(self):
        r = self.submit(self.dev1)
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["status"], "in_review")
        self.assertIsNone(r.data["submit_ack"])
        self.assertEqual(r.data["submissions"][0]["submitted_by"]["id"], self.dev1.pk)

    def test_manager_submit_requests_ack_instead_of_moving_status(self):
        r = self.submit(self.pm, note="PM nomidan yuborilsinmi?")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["status"], "in_progress")
        self.assertFalse(r.data["submissions"])
        self.assertEqual({d["id"] for d in r.data["submit_ack"]["pending"]}, {self.dev1.pk, self.dev2.pk})
        self.assertEqual(r.data["submit_ack"]["requested_by"]["id"], self.pm.pk)
        self.task.refresh_from_db()
        self.assertEqual(self.task.status, "in_progress")
        kinds = {n.recipient_id: n.kind for n in Notification.objects.filter(kind="task_submit_ack_requested")}
        self.assertEqual(set(kinds), {self.dev1.pk, self.dev2.pk})

    def test_manager_cannot_submit_again_while_pending(self):
        self.submit(self.pm)
        r = self.submit(self.pm)
        self.assertEqual(r.status_code, 400)
        self.assertIn("kutamiz", r.data["detail"])

    def test_all_assignees_confirm_then_task_moves_to_review_automatically(self):
        self.submit(self.pm, note="PM so'rovi", files=[docx("shot.png")])
        r = self.ack(self.dev1, True)
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["status"], "in_progress")
        self.assertEqual({d["id"] for d in r.data["submit_ack"]["pending"]}, {self.dev2.pk})

        r = self.ack(self.dev2, True)
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["status"], "in_review")
        self.assertIsNone(r.data["submit_ack"])
        self.assertEqual(r.data["submissions"][0]["note"], "PM so'rovi")
        self.assertEqual(r.data["submissions"][0]["submitted_by"]["id"], self.pm.pk)
        self.assertEqual(len(r.data["submissions"][0]["files"]), 1)
        self.assertTrue(Notification.objects.filter(kind="task_submitted", recipient=self.pm).exists())

    def test_single_assignee_confirm_finalizes_immediately(self):
        solo_task = make_task(self.project, self.pm, self.dev1, status=Task.Status.IN_PROGRESS)
        client_for(self.pm).post(f"/api/tasks/{solo_task.pk}/submit/", {"note": "Yakka ijrochi"}, format="json")
        r = client_for(self.dev1).post(
            f"/api/tasks/{solo_task.pk}/submit-ack/", {"confirmed": True}, format="json"
        )
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["status"], "in_review")

    def test_reject_with_reason_cancels_round_and_task_stays_in_progress(self):
        self.submit(self.pm)
        self.ack(self.dev1, True)
        r = self.ack(self.dev2, False, "Hali tayyor emas")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["status"], "in_progress")
        self.assertIsNone(r.data["submit_ack"])
        self.assertFalse(r.data["submissions"])
        self.assertTrue(Notification.objects.filter(kind="task_submit_ack_rejected", recipient=self.pm).exists())

        # Qayta so'raganda hammadan yangidan so'raladi (eski tasdiq qoldig'i ta'sir qilmaydi)
        r2 = self.submit(self.pm, note="Qayta so'rov")
        self.assertEqual({d["id"] for d in r2.data["submit_ack"]["pending"]}, {self.dev1.pk, self.dev2.pk})

    def test_reject_requires_reason(self):
        self.submit(self.pm)
        r = self.ack(self.dev1, False, "")
        self.assertEqual(r.status_code, 400)

    def test_cannot_ack_twice(self):
        self.submit(self.pm)
        self.ack(self.dev1, True)
        r = self.ack(self.dev1, True)
        self.assertEqual(r.status_code, 400)

    def test_non_assignee_cannot_ack(self):
        self.submit(self.pm)
        outsider = make_user(Role.DEVELOPER)
        r = self.ack(outsider, True)
        self.assertEqual(r.status_code, 404)

    def test_assignee_can_still_submit_directly_while_manager_request_pending(self):
        self.submit(self.pm)
        r = self.submit(self.dev1, note="O'zim yubordim")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["status"], "in_review")
        self.assertIsNone(r.data["submit_ack"])
        self.assertEqual(r.data["submissions"][0]["submitted_by"]["id"], self.dev1.pk)

    def test_changing_assignees_cancels_pending_round(self):
        self.submit(self.pm)
        dev3 = make_user(Role.DEVELOPER)
        from apps.projects.services import ensure_members
        ensure_members(self.project, [dev3])
        r = client_for(self.pm).put(
            f"/api/tasks/{self.task.pk}/assignees/", {"assignee_ids": [self.dev1.pk, dev3.pk]}, format="json"
        )
        self.assertEqual(r.status_code, 200, r.data)
        self.assertIsNone(r.data["submit_ack"])
        # Eski ijrochi (dev2) endi tasdiqlay olmaydi — so'rov bekor qilingan
        r2 = self.ack(self.dev2, True)
        self.assertEqual(r2.status_code, 404)
