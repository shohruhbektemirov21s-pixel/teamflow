from datetime import timedelta

from django.test import TestCase
from django.db.models import ProtectedError
from django.utils import timezone

from apps.accounts.models import Role
from apps.core.models import Comment
from apps.notifications.models import Notification
from apps.panel.tests.factories import client_for, dates, docx, make_user
from apps.projects.models import Project, ProjectMember
from apps.tasks.models import Submission, Task, WorkLog


class TaskFlowTests(TestCase):
    def setUp(self):
        self.pm = make_user(Role.PM)
        self.boss = make_user(Role.BOSS)
        self.dev1 = make_user(Role.DEVELOPER)
        self.dev2 = make_user(Role.DEVELOPER)
        self.outsider = make_user(Role.DEVELOPER)
        self.dept = make_user(Role.DEPARTMENT)
        d = dates()
        self.project = Project.objects.create(code="TF-1", name="Portal", start_date=d["start_date"], end_date=d["end_date"],
                                              created_by=self.pm)
        for dev in (self.dev1, self.dev2):
            ProjectMember.objects.create(project=self.project, developer=dev)

    def create(self, user=None, **kw):
        data = {"project": self.project.pk, "title": "Login sahifasi", "assignee_ids": [self.dev1.pk, self.dev2.pk],
                "due_at": (timezone.now() + timedelta(days=3)).isoformat(),
                "subtasks": [{"title": "Forma", "assignee_ids": [self.dev1.pk]}, {"title": "API"}]}
        data.update(kw)
        return client_for(user or self.pm).post("/api/tasks/", data, format="json")

    def test_create_multi_assignee_with_subtasks(self):
        r = self.create()
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["status"], "control")
        self.assertEqual({a["id"] for a in r.data["assignees"]}, {self.dev1.pk, self.dev2.pk})
        self.assertEqual([s["title"] for s in r.data["subtasks"]], ["Forma", "API"])
        self.assertEqual(Notification.objects.filter(kind="task_assigned").count(), 2)

    def test_assignee_must_be_project_member(self):
        self.assertEqual(self.create(assignee_ids=[self.outsider.pk]).status_code, 400)
        self.assertEqual(self.create(assignee_ids=[]).status_code, 400)

    def test_due_before_start(self):
        now = timezone.now()
        r = self.create(starts_at=now.isoformat(), due_at=(now - timedelta(days=1)).isoformat())
        self.assertEqual(r.status_code, 400)

    def test_developer_creates_only_for_self(self):
        r = self.create(self.dev1, assignee_ids=[self.dev2.pk])
        self.assertEqual(r.status_code, 201)
        self.assertEqual([a["id"] for a in r.data["assignees"]], [self.dev1.pk])
        # Loyihasida bo'lmagan dasturchi — loyiha ko'rinmaydi
        self.assertEqual(self.create(self.outsider).status_code, 404)
        self.assertEqual(self.create(self.dept).status_code, 404)

    def test_visibility(self):
        tid = self.create(assignee_ids=[self.dev1.pk], subtasks=[]).data["id"]
        self.assertEqual(client_for(self.dev1).get(f"/api/tasks/{tid}/").status_code, 200)
        self.assertEqual(client_for(self.dev2).get(f"/api/tasks/{tid}/").status_code, 404)
        self.assertEqual(client_for(self.dept).get(f"/api/tasks/{tid}/").status_code, 404)
        self.assertEqual(client_for(self.boss).get(f"/api/tasks/{tid}/").status_code, 200)

    def test_full_lifecycle(self):
        tid = self.create().data["id"]
        dev = client_for(self.dev1)
        # Nazoratda → tekshiruvga to'g'ridan-to'g'ri bo'lmaydi
        self.assertEqual(dev.post(f"/api/tasks/{tid}/submit/", {"note": "x"}).status_code, 400)
        r = dev.post(f"/api/tasks/{tid}/start/")
        self.assertEqual(r.data["status"], "in_progress")
        self.assertTrue(r.data["actions"]["submit"])
        # Izohsiz yuborib bo'lmaydi
        self.assertEqual(dev.post(f"/api/tasks/{tid}/submit/", {"note": ""}).status_code, 400)
        r = dev.post(f"/api/tasks/{tid}/submit/", {"note": "Forma va API tayyor", "files": [docx("shot.png")]},
                     format="multipart")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["status"], "in_review")
        self.assertEqual(r.data["submissions"][0]["note"], "Forma va API tayyor")
        self.assertTrue(Notification.objects.filter(recipient=self.pm, kind="task_submitted").exists())

        # Dasturchi o'zi qabul qila olmaydi
        self.assertEqual(dev.post(f"/api/tasks/{tid}/review/", {"decision": "accept"}).status_code, 403)

        pm = client_for(self.pm)
        self.assertEqual(pm.post(f"/api/tasks/{tid}/review/", {"decision": "return"}).status_code, 400)
        r = pm.post(f"/api/tasks/{tid}/review/", {"decision": "return", "note": "Validatsiya yo'q"})
        self.assertEqual(r.data["status"], "in_progress")
        self.assertEqual(r.data["submissions"][0]["decision"], "returned")
        self.assertTrue(Notification.objects.filter(recipient=self.dev2, kind="task_returned").exists())

        dev.post(f"/api/tasks/{tid}/submit/", {"note": "Validatsiya qo'shildi"})
        r = client_for(self.boss).post(f"/api/tasks/{tid}/review/", {"decision": "accept"})
        self.assertEqual(r.data["status"], "done")
        self.assertIsNotNone(r.data["completed_at"])
        self.assertEqual([s["round"] for s in r.data["submissions"]], [1, 2])

    def test_non_assignee_cannot_start(self):
        tid = self.create(assignee_ids=[self.dev1.pk], subtasks=[{"title": "Test", "assignee_ids": [self.dev2.pk]}]).data["id"]
        # dev2 sub-vazifa orqali ko'radi, lekin vazifani boshlay olmaydi
        self.assertEqual(client_for(self.dev2).post(f"/api/tasks/{tid}/start/").status_code, 400)

    def test_subtask_create_validates_input(self):
        tid = self.create(assignee_ids=[self.dev1.pk], subtasks=[]).data["id"]
        client = client_for(self.pm)
        for payload in ({}, {"title": ""}, {"title": ["ro'yxat"]}, {"title": "A", "assignee_ids": ["abc"]}):
            with self.subTest(payload=payload):
                self.assertEqual(client.post(f"/api/tasks/{tid}/subtasks/", payload, format="json").status_code, 400)
        r = client.post(f"/api/tasks/{tid}/subtasks/", {"title": "Yangi qadam", "assignee_ids": [self.dev1.pk]}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data["subtasks"][-1]["title"], "Yangi qadam")

    def test_subtask_toggle(self):
        d = self.create(assignee_ids=[self.dev1.pk], subtasks=[{"title": "A", "assignee_ids": [self.dev1.pk]}]).data
        sid = d["subtasks"][0]["id"]
        r = client_for(self.dev1).post(f"/api/tasks/{d['id']}/subtasks/{sid}/toggle/", {"is_done": True})
        self.assertTrue(r.data["subtasks"][0]["is_done"])
        self.assertEqual(r.data["subtasks_progress"], {"done": 1, "total": 1})

    def test_subtask_add_and_delete(self):
        tid = self.create(assignee_ids=[self.dev1.pk], subtasks=[]).data["id"]
        dev1 = client_for(self.dev1)
        r = dev1.post(f"/api/tasks/{tid}/subtasks/", {"title": "Sub 1", "assignee_ids": [self.dev2.pk]}, format="json")
        self.assertEqual(r.status_code, 201)
        sub_id = r.data["subtasks"][0]["id"]
        self.assertEqual(r.data["subtasks"][0]["title"], "Sub 1")
        self.assertEqual([u["id"] for u in r.data["subtasks"][0]["assignees"]], [self.dev2.pk])
        self.assertTrue(r.data["subtasks"][0]["can_delete"])

        r_del = dev1.delete(f"/api/tasks/{tid}/subtasks/{sub_id}/")
        self.assertEqual(r_del.status_code, 200)
        self.assertEqual(len(r_del.data["subtasks"]), 0)

    def test_only_manager_edits_and_deletes(self):
        tid = self.create().data["id"]
        self.assertEqual(client_for(self.dev1).patch(f"/api/tasks/{tid}/", {"title": "X"}, format="json").status_code, 403)
        r = client_for(self.pm).patch(f"/api/tasks/{tid}/", {"title": "Yangi nom", "assignee_ids": [self.dev2.pk]},
                                      format="json")
        self.assertEqual(r.data["title"], "Yangi nom")
        self.assertEqual([a["id"] for a in r.data["assignees"]], [self.dev2.pk])
        self.assertEqual(client_for(self.dev1).delete(f"/api/tasks/{tid}/").status_code, 403)
        self.assertEqual(client_for(self.pm).delete(f"/api/tasks/{tid}/").status_code, 204)

    def test_completed_task_cannot_be_edited(self):
        tid = self.create(assignee_ids=[self.dev1.pk], subtasks=[]).data["id"]
        task = Task.objects.get(pk=tid)
        task.status = Task.Status.DONE
        task.completed_at = timezone.now()
        task.save(update_fields=["status", "completed_at"])
        pm = client_for(self.pm)
        response = pm.patch(f"/api/tasks/{tid}/", {
            "title": "Changed", "assignee_ids": [self.dev2.pk],
            "subtasks": [{"title": "Changed step", "assignee_ids": [self.dev2.pk]}],
        }, format="json")
        self.assertEqual(response.status_code, 400)
        task.refresh_from_db()
        self.assertEqual(task.title, "Login sahifasi")
        self.assertEqual(list(task.assignees.values_list("pk", flat=True)), [self.dev1.pk])
        self.assertFalse(task.subtasks.exists())
        self.assertFalse(pm.get(f"/api/tasks/{tid}/").data["actions"]["edit"])

    def test_delete_archives_task_without_losing_work_history(self):
        tid = self.create().data["id"]
        task = Task.objects.get(pk=tid)
        developer = client_for(self.dev1)
        developer.post(f"/api/tasks/{tid}/start/")
        developer.post(f"/api/tasks/{tid}/worklogs/", {
            "work_date": timezone.localdate().isoformat(), "hours": "2.00", "note": "API tayyor",
        }, format="json")
        developer.post(f"/api/tasks/{tid}/submit/", {"note": "Tekshiruvga tayyor"})
        comment = Comment.objects.create(author=self.dev1, text="Muhim izoh", target=task)

        manager = client_for(self.pm)
        self.assertEqual(manager.delete(f"/api/tasks/{tid}/").status_code, 204)

        task.refresh_from_db()
        self.assertIsNotNone(task.archived_at)
        self.assertTrue(WorkLog.objects.filter(task=task, note="API tayyor").exists())
        self.assertTrue(Submission.objects.filter(task=task, note="Tekshiruvga tayyor").exists())
        self.assertEqual(Comment.objects.get(pk=comment.pk).target, task)
        self.assertEqual(manager.post("/api/comments/", {"target_type": "task", "target_id": tid,
                                                     "text": "Arxivga yangi izoh"}, format="json").status_code, 403)
        self.assertNotIn(tid, [item["id"] for item in manager.get("/api/tasks/?all=1").data])
        detail = manager.get(f"/api/tasks/{tid}/")
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(detail.data["worklogs"][0]["can_delete"], False)
        self.assertFalse(any(detail.data["actions"].values()))
        self.assertEqual(manager.get(f"/api/projects/{self.project.pk}/").data["progress"]["total"], 0)
        history = manager.get(f"/api/history/?task={tid}&paginated=1").data["results"]
        self.assertTrue(any(item["verb"] == "task_deleted" and item["target"]["id"] == tid for item in history))
        with self.assertRaises(ProtectedError):
            self.project.delete()
        self.assertEqual(manager.patch(f"/api/tasks/{tid}/", {"title": "X"}, format="json").status_code, 404)
        self.assertEqual(manager.delete(f"/api/tasks/{tid}/").status_code, 404)

    def test_archived_completed_task_remains_in_work_report(self):
        tid = self.create().data["id"]
        Task.objects.filter(pk=tid).update(status=Task.Status.DONE, completed_at=timezone.now())
        manager = client_for(self.pm)

        self.assertEqual(manager.delete(f"/api/tasks/{tid}/").status_code, 204)

        completed = manager.get("/api/workdone/?days=7").data["completed_tasks"]
        self.assertIn(tid, [item["id"] for item in completed])


class DashboardTests(TestCase):
    def setUp(self):
        self.pm = make_user(Role.PM)
        self.dev = make_user(Role.DEVELOPER)
        self.idle = make_user(Role.DEVELOPER)
        d = dates()
        self.project = Project.objects.create(code="DASH-1", name="P", start_date=d["start_date"], end_date=d["end_date"],
                                              created_by=self.pm)
        ProjectMember.objects.create(project=self.project, developer=self.dev)
        now = timezone.now()
        self.overdue = self._task("Kechikkan", due_at=now - timedelta(days=1))
        self._task("Faol", due_at=now + timedelta(days=2))
        self._task("Kech bajarilgan", status=Task.Status.DONE, due_at=now - timedelta(days=2),
                   completed_at=now - timedelta(days=1))
        self._task("Tekshiruvda", status=Task.Status.IN_REVIEW)

    def _task(self, title, **kw):
        t = Task.objects.create(project=self.project, title=title, created_by=self.pm, **kw)
        t.assignees.add(self.dev)
        return t

    def test_counts_match_table(self):
        pm = client_for(self.pm)
        d = pm.get("/api/dashboard/").data
        self.assertEqual(d["totals"], {"late": 1, "overdue": 1, "review": 1, "active": 3})
        year = d["periods"][0]
        self.assertEqual(year["counts"], {"active": 3, "overdue": 1, "done": 1})
        # Karta bosilganda chiqadigan jadval shu son bilan mos
        for bucket, expected in (("overdue", 1), ("late", 1), ("review", 1)):
            r = pm.get(f"/api/tasks/?bucket={bucket}")
            self.assertEqual(r.data["count"], expected, bucket)
        self.assertEqual(pm.get("/api/tasks/?bucket=active&period=year").data["count"], 3)

    def test_people_idle_first(self):
        r = client_for(self.pm).get("/api/people/")
        self.assertEqual(r.data[0]["id"], self.idle.pk)
        dev_row = next(p for p in r.data if p["id"] == self.dev.pk)
        self.assertEqual(dev_row["active_tasks"], 3)
        self.assertEqual(dev_row["overdue_tasks"], 1)
        self.assertEqual(client_for(self.dev).get("/api/people/").status_code, 403)

    def test_person_profile_matches_people_row(self):
        pm = client_for(self.pm)
        row = next(p for p in pm.get("/api/people/").data if p["id"] == self.dev.pk)
        self.assertEqual(pm.get(f"/api/people/{self.dev.pk}/").data, row)
        self.assertEqual(client_for(self.dev).get(f"/api/people/{self.dev.pk}/").status_code, 403)
        self.assertEqual(pm.get("/api/people/999999/").status_code, 404)

    def test_developer_dashboard_only_own(self):
        other = make_user(Role.DEVELOPER)
        ProjectMember.objects.create(project=self.project, developer=other)
        t = Task.objects.create(project=self.project, title="Boshqa", created_by=self.pm)
        t.assignees.add(other)
        d = client_for(self.dev).get("/api/dashboard/").data
        self.assertEqual(d["totals"]["active"], 3)

    def test_board_filters(self):
        dev = client_for(self.dev)
        r = dev.get("/api/tasks/?mine=1&all=1")
        self.assertEqual(len(r.data), 4)  # sahifalashsiz ro'yxat
        self.assertEqual(len(dev.get("/api/tasks/?mine=1&all=1&due=today").data), 0)

    def test_search_and_comments(self):
        pm = client_for(self.pm)
        self.assertEqual(len(pm.get("/api/search/?q=Kech").data["tasks"]), 2)
        r = pm.post("/api/comments/", {"target_type": "task", "target_id": self.overdue.pk, "text": "Tezlashtiring"},
                    format="json")
        self.assertEqual(r.status_code, 201)
        self.assertTrue(Notification.objects.filter(recipient=self.dev, kind="comment").exists())
        outsider = make_user(Role.DEVELOPER)
        r = client_for(outsider).get(f"/api/comments/?target_type=task&target_id={self.overdue.pk}")
        self.assertEqual(r.status_code, 404)
        self.assertEqual(len(client_for(self.dev).get(
            f"/api/comments/?target_type=task&target_id={self.overdue.pk}").data), 1)

    def test_notifications_flow(self):
        client_for(self.pm).post("/api/comments/", {"target_type": "task", "target_id": self.overdue.pk, "text": "Hi"},
                                 format="json")
        dev = client_for(self.dev)
        self.assertEqual(dev.get("/api/notifications/unread_count/").data["count"], 1)
        n = dev.get("/api/notifications/").data["results"][0]
        self.assertEqual(n["target"], {"type": "task", "id": self.overdue.pk})
        dev.post(f"/api/notifications/{n['id']}/read/")
        self.assertEqual(dev.get("/api/notifications/unread_count/").data["count"], 0)
