"""Review (2026-10-09) topilmalari: yakunlash davrida ish biriktirish, "hamma rozimi" qoidasi bitta joyda,
yakunlangan qilib yaratish, jamoa o'zgarmasa tasdiqlar saqlanishi."""
from django.test import TestCase
from django.utils import timezone

from apps.accounts.models import Role
from apps.core.api_utils import ServiceError
from apps.notifications.models import Notification
from apps.panel.tests.factories import client_for, make_project, make_task, make_user
from apps.projects import services
from apps.projects.models import Project, ProjectCompletionAck
from apps.tasks import services as tasks

S = Project.Stage


def dates():
    today = timezone.localdate().isoformat()
    return {"start_date": today, "end_date": today}


class CompletionLockTests(TestCase):
    def setUp(self):
        self.pm = make_user(Role.PM)
        self.a = make_user(Role.DEVELOPER)
        self.b = make_user(Role.DEVELOPER)
        self.outsider = make_user(Role.DEVELOPER)
        self.project = make_project(self.pm, self.a)
        self.task = make_task(self.project, self.pm, self.a)

    def lock(self, stage=S.PLANNED, requested=None):
        Project.objects.filter(pk=self.project.pk).update(stage=stage, completion_requested_at=requested)

    def test_no_assignment_in_done_pending_or_ack_round(self):
        pm = client_for(self.pm)
        for stage, requested in ((S.DONE, None), (S.PENDING_APPROVAL, None), (S.PLANNED, timezone.now())):
            self.lock(stage, requested)
            with self.subTest(stage=stage, requested=bool(requested)):
                url = f"/api/tasks/{self.task.pk}/"
                self.assertEqual(pm.put(url + "assignees/", {"assignee_ids": [self.a.pk, self.outsider.pk]},
                                        format="json").status_code, 400)
                self.assertEqual(pm.post(url + "subtasks/", {"title": "S", "assignee_ids": [self.outsider.pk]},
                                         format="json").status_code, 400)
                self.assertEqual(pm.patch(url, {"assignee_ids": [self.a.pk]}, format="json").status_code, 400)
                actions = pm.get(url).data["actions"]
                self.assertFalse(actions["manage_assignees"])
                self.assertFalse(actions["manage_subtasks"])
        self.assertFalse(self.project.memberships.filter(developer=self.outsider).exists())
        # Oddiy tahrirlash (nom) yopiq emas
        self.assertEqual(pm.patch(f"/api/tasks/{self.task.pk}/", {"title": "Yangi"}, format="json").status_code, 200)

    def test_open_project_still_allows_assignment(self):
        r = client_for(self.pm).put(f"/api/tasks/{self.task.pk}/assignees/",
                                    {"assignee_ids": [self.a.pk, self.outsider.pk]}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertTrue(self.project.memberships.filter(developer=self.outsider).exists())

    def test_new_member_cannot_slip_into_ack_round(self):
        services.update_project(self.project, self.pm, stage=S.DONE)
        with self.assertRaises(ServiceError):
            tasks.set_task_assignees(self.task, self.pm, [self.a.pk, self.outsider.pk])
        services.ack_completion(self.project, self.a, confirmed=True)
        services.update_project(self.project, self.pm, stage=S.DONE)
        self.project.refresh_from_db()
        self.assertEqual(self.project.stage, S.DONE)
        self.assertFalse(self.project.memberships.filter(developer=self.outsider).exists())


class CreateAsDoneTests(TestCase):
    def setUp(self):
        self.pm = make_user(Role.PM)
        self.dev = make_user(Role.DEVELOPER)

    def test_create_done_with_team_asks_developers_first(self):
        r = client_for(self.pm).post("/api/projects/", {"code": "D1", "name": "N", **dates(), "stage": "done",
                                                        "member_ids": [self.dev.pk]}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        project = Project.objects.get(pk=r.data["id"])
        self.assertEqual(project.stage, S.PLANNED)
        self.assertIsNotNone(project.completion_requested_at)
        self.assertTrue(ProjectCompletionAck.objects.filter(project=project, developer=self.dev).exists())

    def test_create_done_without_team_is_done(self):
        r = client_for(self.pm).post("/api/projects/", {"code": "D2", "name": "N", **dates(), "stage": "done"},
                                     format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(Project.objects.get(pk=r.data["id"]).stage, S.DONE)


class SingleAckRuleTests(TestCase):
    """Bloklangan dasturchi yakunlashni to'xtatib qo'ymaydi — xabar, tugma va server bir xil hisoblaydi."""

    def setUp(self):
        self.pm = make_user(Role.PM)
        self.a = make_user(Role.DEVELOPER)
        self.b = make_user(Role.DEVELOPER)
        self.project = make_project(self.pm, self.a, self.b)
        services.update_project(self.project, self.pm, stage=S.DONE)

    def test_deactivated_developer_does_not_block_completion(self):
        self.b.is_active = False
        self.b.save(update_fields=["is_active"])
        services.ack_completion(self.project, self.a, confirmed=True)
        self.assertTrue(Notification.objects.filter(kind=Notification.Kind.PROJECT_COMPLETION_ACK_DONE).exists())
        pm = client_for(self.pm)
        detail = pm.get(f"/api/projects/{self.project.pk}/").data
        self.assertIn(S.DONE, detail["stage_targets"])
        self.assertEqual(detail["completion"]["pending"], [])
        r = pm.patch(f"/api/projects/{self.project.pk}/", {"stage": "done", "completion_note": "Tayyor"}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["stage"], S.DONE)

    def test_active_pending_developer_still_blocks(self):
        services.ack_completion(self.project, self.a, confirmed=True)
        self.assertFalse(Notification.objects.filter(kind=Notification.Kind.PROJECT_COMPLETION_ACK_DONE).exists())
        detail = client_for(self.pm).get(f"/api/projects/{self.project.pk}/").data
        self.assertNotIn(S.DONE, detail["stage_targets"])
        self.assertEqual([u["id"] for u in detail["completion"]["pending"]], [self.b.pk])


class SetMembersKeepsRoundTests(TestCase):
    def setUp(self):
        self.pm = make_user(Role.PM)
        self.a = make_user(Role.DEVELOPER)
        self.b = make_user(Role.DEVELOPER)
        self.project = make_project(self.pm, self.a)
        services.update_project(self.project, self.pm, stage=S.DONE)
        services.ack_completion(self.project, self.a, confirmed=True)

    def put(self, ids):
        r = client_for(self.pm).put(f"/api/projects/{self.project.pk}/members/", {"member_ids": ids}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.project.refresh_from_db()

    def test_unchanged_team_keeps_confirmations(self):
        self.put([self.a.pk])
        self.assertIsNotNone(self.project.completion_requested_at)
        self.assertTrue(self.project.completion_acks.filter(developer=self.a, confirmed=True).exists())

    def test_changed_team_restarts_round(self):
        self.put([self.a.pk, self.b.pk])
        self.assertIsNone(self.project.completion_requested_at)
        self.assertFalse(self.project.completion_acks.exists())
