from itertools import count

from django.test import TestCase

from apps.accounts.models import Role
from apps.notifications.models import Notification
from apps.orders.models import Order
from apps.panel.tests.factories import client_for, dates, docx, future, make_user
from apps.projects.models import Project


class ProjectTests(TestCase):
    _seq = count(1)

    def setUp(self):
        self.pm = make_user(Role.PM)
        self.boss = make_user(Role.BOSS)
        self.dev1 = make_user(Role.DEVELOPER)
        self.dev2 = make_user(Role.DEVELOPER)
        self.dept = make_user(Role.DEPARTMENT)

    def create(self, user=None, **kw):
        data = {"code": f"PRJ-{next(self._seq)}", "name": "Portal", "description": "Ichki portal", **dates(),
                "member_ids": [self.dev1.pk, self.dev2.pk]}
        data.update(kw)
        return client_for(user or self.pm).post("/api/projects/", data, format="json")

    def test_pm_and_boss_create_with_members(self):
        r = self.create()
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual({m["id"] for m in r.data["members"]}, {self.dev1.pk, self.dev2.pk})
        self.assertEqual(r.data["stage"], "planned")
        self.assertEqual(self.create(self.boss).status_code, 201)

    def test_developer_and_department_cannot_create(self):
        self.assertEqual(self.create(self.dev1).status_code, 403)
        self.assertEqual(self.create(self.dept).status_code, 403)

    def test_only_developers_can_be_members(self):
        r = self.create(member_ids=[self.dept.pk])
        self.assertEqual(r.status_code, 400)

    def test_end_before_start(self):
        r = self.create(start_date=str(future(5)), end_date=str(future(1)))
        self.assertEqual(r.status_code, 400)

    def test_code_is_required(self):
        r = self.create(code="")
        self.assertEqual(r.status_code, 400)

    def test_duplicate_code_is_rejected(self):
        self.assertEqual(self.create(code="DUP-1").status_code, 201)
        r = self.create(code="DUP-1")
        self.assertEqual(r.status_code, 400)
        self.assertIn("code", r.data.get("fields", {}))

    def test_multipart_with_files(self):
        r = client_for(self.pm).post(
            "/api/projects/",
            {"code": "MP-1", "name": "P", **dates(), "member_ids": f"[{self.dev1.pk}]", "files": [docx("a.docx"), docx("b.pdf")]},
            format="multipart",
        )
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(len(r.data["files"]), 2)
        self.assertEqual(len(r.data["members"]), 1)

    def test_developer_sees_only_own_projects(self):
        pid = self.create(member_ids=[self.dev1.pk]).data["id"]
        self.assertEqual(client_for(self.dev1).get(f"/api/projects/{pid}/").status_code, 200)
        self.assertEqual(client_for(self.dev2).get(f"/api/projects/{pid}/").status_code, 404)
        self.assertEqual(client_for(self.dept).get("/api/projects/").data["count"], 0)

    def test_stage_change_and_members(self):
        pid = self.create().data["id"]
        pm = client_for(self.pm)
        r = pm.patch(f"/api/projects/{pid}/", {"stage": "needs_fix"}, format="json")
        self.assertEqual(r.data["stage"], "needs_fix")
        r = pm.put(f"/api/projects/{pid}/members/", {"member_ids": [self.dev2.pk]}, format="json")
        self.assertEqual([m["id"] for m in r.data["members"]], [self.dev2.pk])
        self.assertEqual(client_for(self.dev1).patch(f"/api/projects/{pid}/", {"stage": "done"},
                                                     format="json").status_code, 403)


class ProjectFromOrderTests(TestCase):
    def setUp(self):
        self.pm = make_user(Role.PM)
        self.dept = make_user(Role.DEPARTMENT)
        self.dev = make_user(Role.DEVELOPER)
        r = client_for(self.dept).post(
            "/api/orders/",
            {"title": "Hisobot moduli", "description": "Oylik hisobot", "requested_due_date": str(future(30)),
             "file": docx("tz.docx")},
            format="multipart",
        )
        self.order_id = r.data["id"]

    def test_cannot_create_before_approval(self):
        r = client_for(self.pm).post("/api/projects/", {"code": "ORD-1", "order": self.order_id}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_create_from_order_copies_data_and_uses_pm_dates(self):
        pm = client_for(self.pm)
        pm_dates = dates(14)
        pm.post(f"/api/orders/{self.order_id}/approve/", pm_dates, format="json")
        r = pm.post("/api/projects/", {"code": "ORD-2", "order": self.order_id, "member_ids": [self.dev.pk]}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["name"], "Hisobot moduli")
        self.assertEqual(r.data["description"], "Oylik hisobot")
        self.assertEqual(r.data["start_date"], pm_dates["start_date"])
        self.assertEqual(r.data["end_date"], pm_dates["end_date"])
        self.assertEqual([f["name"] for f in r.data["files"]], ["tz.docx"])
        self.assertEqual(r.data["order"]["id"], self.order_id)
        self.assertEqual(Order.objects.get(pk=self.order_id).status, Order.Status.PROJECT_CREATED)
        # Ikkinchi marta yaratib bo'lmaydi
        self.assertEqual(pm.post("/api/projects/", {"code": "ORD-3", "order": self.order_id}, format="json").status_code, 400)

        # Buyurtmadan yaratilgan loyihada nom/izoh/sana ham o'zgaradi, bog'liq buyurtmaga ham ko'chadi
        pid = r.data["id"]
        self.assertTrue(r.data["actions"]["edit_info"])
        r = pm.patch(f"/api/projects/{pid}/", {"name": "Boshqa"}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(Order.objects.get(pk=self.order_id).title, "Boshqa")
        new = dates(40)
        r = pm.patch(f"/api/projects/{pid}/", new, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(Order.objects.get(pk=self.order_id).end_date.isoformat(), new["end_date"])
        # TZ fayli loyiha a'zosi dasturchiga ham ochiladi
        url = r.data["files"][0]["url"]
        self.assertEqual(client_for(self.dev).get(url).status_code, 200)
        self.assertEqual(Project.objects.count(), 1)

    def test_create_from_order_with_done_requests_department_approval(self):
        pm = client_for(self.pm)
        pm.post(f"/api/orders/{self.order_id}/approve/", dates(14), format="json")
        response = pm.post("/api/projects/", {
            "code": "ORD-DONE", "order": self.order_id, "stage": "done",
        }, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["stage"], Project.Stage.PENDING_APPROVAL)
        self.assertEqual(Project.objects.get(pk=response.data["id"]).stage, Project.Stage.PENDING_APPROVAL)
        self.assertEqual(client_for(self.dept).get(f"/api/orders/{self.order_id}/").data["project"]["stage"],
                         Project.Stage.PENDING_APPROVAL)

    def test_pending_approval_cannot_be_selected_on_create(self):
        response = client_for(self.pm).post("/api/projects/", {
            "code": "ORD-PENDING", "name": "Portal", **dates(), "stage": Project.Stage.PENDING_APPROVAL,
        }, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertFalse(Project.objects.exists())


class ProjectCompletionTests(TestCase):
    """Buyurtmadan yaratilgan loyihani yakunlash — boshqarma tasdig'i kerak."""

    def setUp(self):
        self.pm = make_user(Role.PM)
        self.dept = make_user(Role.DEPARTMENT)
        self.other_dept = make_user(Role.DEPARTMENT)
        r = client_for(self.dept).post(
            "/api/orders/",
            {"title": "Portal", "description": "Izoh", "requested_due_date": str(future(30)), "file": docx("tz.docx")},
            format="multipart",
        )
        order_id = r.data["id"]
        pm = client_for(self.pm)
        pm.post(f"/api/orders/{order_id}/approve/", dates(14), format="json")
        self.pid = pm.post("/api/projects/", {"code": "COMP-1", "order": order_id}, format="json").data["id"]

    def finish(self):
        return client_for(self.pm).patch(f"/api/projects/{self.pid}/", {"stage": "done"}, format="json")

    def test_completion_report_is_visible_and_downloadable_only_to_own_department(self):
        pm = client_for(self.pm)
        response = pm.patch(f"/api/projects/{self.pid}/", {
            "stage": "done", "completion_note": "  Portal tayyor.  ", "files": [docx("natija.docx"), docx("hisobot.pdf")],
        }, format="multipart")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data["completion_note"], "Portal tayyor.")
        project = Project.objects.get(pk=self.pid)
        report = client_for(self.dept).get(f"/api/orders/{project.order_id}/").data["completion_report"]
        self.assertEqual(report["note"], "Portal tayyor.")
        self.assertEqual({f["name"] for f in report["files"]}, {"natija.docx", "hisobot.pdf"})
        for f in report["files"]:
            download = client_for(self.dept).get(f["url"])
            self.assertEqual(download.status_code, 200)
            download.close()
            self.assertEqual(client_for(self.other_dept).get(f["url"]).status_code, 404)
        tz = project.files.get(is_completion=False)
        self.assertEqual(client_for(self.dept).get(f"/api/files/project/{tz.pk}/").status_code, 404)

    def test_invalid_completion_upload_does_not_start_completion(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        response = client_for(self.pm).patch(f"/api/projects/{self.pid}/", {
            "stage": "done", "completion_note": "Tayyor", "files": [SimpleUploadedFile("bad.exe", b"bad")],
        }, format="multipart")
        self.assertEqual(response.status_code, 400)
        project = Project.objects.get(pk=self.pid)
        self.assertEqual(project.stage, "planned")
        self.assertEqual(project.completion_note, "")
        self.assertFalse(project.files.filter(is_completion=True).exists())

    def test_report_without_completion_stage_is_rejected(self):
        response = client_for(self.pm).patch(f"/api/projects/{self.pid}/", {"completion_note": "Tayyor"}, format="json")
        self.assertEqual(response.status_code, 400)

    def test_resubmission_shows_only_latest_completion_files(self):
        pm = client_for(self.pm)
        url = f"/api/projects/{self.pid}/"
        response = pm.patch(url, {"stage": "done", "completion_note": "Birinchi", "files": [docx("old.docx")]}, format="multipart")
        self.assertEqual(response.status_code, 200, response.data)
        dept = client_for(self.dept)
        response = dept.post(f"/api/projects/{self.pid}/reject-completion/", {"reason": "Tuzatish kerak"}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        response = pm.patch(url, {"stage": "done", "completion_note": "Tuzatildi", "files": [docx("new.docx")]}, format="multipart")
        self.assertEqual(response.status_code, 200, response.data)
        project = Project.objects.get(pk=self.pid)
        report = dept.get(f"/api/orders/{project.order_id}/").data["completion_report"]
        self.assertEqual(report["note"], "Tuzatildi")
        self.assertEqual([f["name"] for f in report["files"]], ["new.docx"])
        self.assertTrue(project.files.filter(original_name="old.docx", is_completion=False).exists())

    def test_report_survives_developer_confirmation(self):
        from apps.projects.models import ProjectMember
        dev = make_user(Role.DEVELOPER)
        ProjectMember.objects.create(project_id=self.pid, developer=dev)
        response = client_for(self.pm).patch(f"/api/projects/{self.pid}/", {
            "stage": "done", "completion_note": "Portal tayyor", "files": [docx("natija.docx")],
        }, format="multipart")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIsNotNone(response.data["completion"])
        project = Project.objects.get(pk=self.pid)
        dept = client_for(self.dept)
        self.assertIsNone(dept.get(f"/api/orders/{project.order_id}/").data["completion_report"])
        response = client_for(dev).post(f"/api/projects/{self.pid}/completion-ack/", {"confirmed": True}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertIsNone(dept.get(f"/api/orders/{project.order_id}/").data["completion_report"])
        response = client_for(self.pm).patch(f"/api/projects/{self.pid}/", {"stage": "done"}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        report = dept.get(f"/api/orders/{project.order_id}/").data["completion_report"]
        self.assertEqual(report["note"], "Portal tayyor")
        self.assertEqual(report["files"][0]["name"], "natija.docx")

    def test_manager_without_order_finishes_directly(self):
        pm = client_for(self.pm)
        pid = pm.post("/api/projects/", {"code": "COMP-2", "name": "Ichki", **dates(), "member_ids": []}, format="json").data["id"]
        r = pm.patch(f"/api/projects/{pid}/", {"stage": "done"}, format="json")
        self.assertEqual(r.data["stage"], "done")

    def test_manager_with_order_goes_to_pending_approval_not_done(self):
        r = self.finish()
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["stage"], "pending_approval")
        self.assertEqual(r.data["stage_targets"], [])  # qaror endi boshqarmaga tegishli
        kinds = [n["kind"] for n in client_for(self.dept).get("/api/notifications/").data["results"]]
        self.assertIn("project_completion_requested", kinds)

    def test_department_confirms_completion(self):
        self.finish()
        r = client_for(self.dept).post(f"/api/projects/{self.pid}/confirm-completion/")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(Project.objects.get(pk=self.pid).stage, "done")
        kinds = [n["kind"] for n in client_for(self.pm).get("/api/notifications/").data["results"]]
        self.assertIn("project_completion_approved", kinds)

    def test_department_rejects_completion_with_reason(self):
        self.finish()
        dept = client_for(self.dept)
        r = dept.post(f"/api/projects/{self.pid}/reject-completion/", {"reason": ""}, format="json")
        self.assertEqual(r.status_code, 400)
        r = dept.post(f"/api/projects/{self.pid}/reject-completion/", {"reason": "Hujjat yetarli emas"}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(Project.objects.get(pk=self.pid).stage, "rejected")
        order_id = Project.objects.get(pk=self.pid).order_id
        detail = dept.get(f"/api/orders/{order_id}/").data
        self.assertEqual(detail["project"]["stage_label"], "Rad etildi")
        self.assertFalse(detail["actions"]["decide_completion"])
        self.assertEqual(self.finish().data["stage"], "pending_approval")
        kinds = [n["kind"] for n in client_for(self.pm).get("/api/notifications/").data["results"]]
        self.assertIn("project_completion_rejected", kinds)

    def test_only_owning_department_can_decide(self):
        self.finish()
        r = client_for(self.other_dept).post(f"/api/projects/{self.pid}/confirm-completion/")
        self.assertEqual(r.status_code, 403)

    def test_pm_cannot_call_department_decision_endpoints(self):
        self.finish()
        r = client_for(self.pm).post(f"/api/projects/{self.pid}/confirm-completion/")
        self.assertEqual(r.status_code, 403)

    def test_order_detail_exposes_project_stage_and_actions(self):
        self.finish()
        r = client_for(self.dept).get(f"/api/orders/{Project.objects.get(pk=self.pid).order_id}/")
        self.assertEqual(r.data["project"]["stage"], "pending_approval")
        self.assertTrue(r.data["actions"]["decide_completion"])

    def test_order_list_also_exposes_project_stage(self):
        """Buyurtma ro'yxatida `status` loyiha yaratilgach "project_created"da qotib qoladi — boshqarma
        ro'yxatda ham loyihaning haqiqiy darajasini (masalan "Tasdiqlash kutilmoqda") ko'ra olishi kerak,
        faqat buyurtmani ochib ko'rganda emas (review 2026-10-05)."""
        self.finish()
        order_id = Project.objects.get(pk=self.pid).order_id
        results = client_for(self.dept).get("/api/orders/").data["results"]
        row = next(o for o in results if o["id"] == order_id)
        self.assertEqual(row["status"], "project_created")
        self.assertEqual(row["project"]["stage"], "pending_approval")

    def test_pending_approval_is_not_a_direct_choice(self):
        """`pending_approval` faqat "done" so'ralganda ichki hosil bo'ladi — PM/Boshliq uni to'g'ridan-to'g'ri
        tanlay olmaydi (aks holda buyurtmasiz loyihada 500 xato berardi — review 2026-10-02)."""
        pm = client_for(self.pm)
        r = pm.patch(f"/api/projects/{self.pid}/", {"stage": "pending_approval"}, format="json")
        self.assertEqual(r.status_code, 400)

        pid2 = pm.post("/api/projects/", {"code": "COMP-3", "name": "Ichki", **dates(), "member_ids": []}, format="json").data["id"]
        r2 = pm.patch(f"/api/projects/{pid2}/", {"stage": "pending_approval"}, format="json")
        self.assertEqual(r2.status_code, 400)
        self.assertNotIn("pending_approval", pm.get(f"/api/projects/{pid2}/").data["stage_targets"])


class ProjectCompletionAckTests(TestCase):
    """Yakunlashdan oldin loyihadagi barcha faol dasturchilar tasdiqlashi kerak (2026-10-05)."""

    def setUp(self):
        self.pm = make_user(Role.PM)
        self.dev1 = make_user(Role.DEVELOPER)
        self.dev2 = make_user(Role.DEVELOPER)
        pm = client_for(self.pm)
        self.pid = pm.post(
            "/api/projects/",
            {"code": "ACK-1", "name": "Portal", **dates(), "member_ids": [self.dev1.pk, self.dev2.pk]},
            format="json",
        ).data["id"]

    def finish(self, user=None):
        return client_for(user or self.pm).patch(f"/api/projects/{self.pid}/", {"stage": "done"}, format="json")

    def ack(self, dev, confirmed, reason=""):
        return client_for(dev).post(
            f"/api/projects/{self.pid}/completion-ack/", {"confirmed": confirmed, "reason": reason}, format="json"
        )

    def test_first_click_requests_acks_instead_of_finishing(self):
        r = self.finish()
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["stage"], "planned")
        self.assertNotIn("done", r.data["stage_targets"])
        self.assertEqual({p["id"] for p in r.data["completion"]["pending"]}, {self.dev1.pk, self.dev2.pk})
        kinds1 = [n["kind"] for n in client_for(self.dev1).get("/api/notifications/").data["results"]]
        self.assertIn("project_completion_ack_requested", kinds1)

    def test_all_confirm_allows_pm_to_finish(self):
        self.finish()
        self.ack(self.dev1, True)
        mid = client_for(self.pm).get(f"/api/projects/{self.pid}/").data
        self.assertEqual({p["id"] for p in mid["completion"]["pending"]}, {self.dev2.pk})
        self.assertNotIn("done", mid["stage_targets"])
        self.ack(self.dev2, True)
        kinds_pm = [n["kind"] for n in client_for(self.pm).get("/api/notifications/").data["results"]]
        self.assertIn("project_completion_ack_done", kinds_pm)

        # Oxirgi rozilik faqat PMga yakunlash imkonini beradi.
        after_all = client_for(self.pm).get(f"/api/projects/{self.pid}/").data
        self.assertEqual(after_all["stage"], "planned")
        self.assertIn("done", after_all["stage_targets"])
        self.assertEqual(after_all["completion"]["pending"], [])
        self.assertEqual({u["id"] for u in after_all["completion"]["confirmed"]}, {self.dev1.pk, self.dev2.pk})
        self.assertFalse(after_all["actions"]["add_task"])
        finished = self.finish()
        self.assertEqual(finished.status_code, 200, finished.data)
        self.assertEqual(finished.data["stage"], "done")
        self.assertIsNone(finished.data["completion"])

    def test_reject_with_reason_cancels_round_and_project_stays(self):
        self.finish()
        self.ack(self.dev1, True)
        r = self.ack(self.dev2, False, "Testlar tugamagan")
        self.assertEqual(r.status_code, 200, r.data)
        detail = client_for(self.pm).get(f"/api/projects/{self.pid}/").data
        self.assertEqual(detail["stage"], "planned")
        self.assertIsNone(detail["completion"])
        self.assertIn("done", detail["stage_targets"])
        kinds_pm = [n["kind"] for n in client_for(self.pm).get("/api/notifications/").data["results"]]
        self.assertIn("project_completion_ack_rejected", kinds_pm)

    def test_reject_requires_reason(self):
        self.finish()
        r = self.ack(self.dev1, False, "")
        self.assertEqual(r.status_code, 400)

    def test_cannot_ack_twice(self):
        self.finish()
        self.ack(self.dev1, True)
        r = self.ack(self.dev1, True)
        self.assertEqual(r.status_code, 400)

    def test_non_member_cannot_ack(self):
        """Begona dasturchi uchun loyiha umuman ko'rinmaydi (`visible_projects`) — 404, boshqa
        sahifalardagi kabi (masalan `test_developer_sees_only_own_projects`)."""
        self.finish()
        outsider = make_user(Role.DEVELOPER)
        r = self.ack(outsider, True)
        self.assertEqual(r.status_code, 404)

    def test_cannot_ack_before_requested(self):
        r = self.ack(self.dev1, True)
        self.assertEqual(r.status_code, 403)

    def test_changing_team_mid_round_cancels_it(self):
        self.finish()
        pm = client_for(self.pm)
        pm.put(f"/api/projects/{self.pid}/members/", {"member_ids": [self.dev1.pk]}, format="json")
        detail = pm.get(f"/api/projects/{self.pid}/").data
        self.assertIsNone(detail["completion"])
        self.assertIn("done", detail["stage_targets"])

    def test_reclicking_done_while_still_pending_returns_400_not_crash(self):
        """review 2026-10-05: oldingi "pending_approval" bugi aynan shunday — sinab ko'rilmagan
        qayta-bosish holati 500 bergan edi. Shu safar kod yo'lini aniq test qilib tasdiqlaymiz."""
        self.finish()
        r = self.finish()
        self.assertEqual(r.status_code, 400, r.data)
        self.assertEqual(Project.objects.get(pk=self.pid).stage, "planned")


class ProjectCompletionAckWithOrderTests(TestCase):
    """Buyurtmali loyihada dasturchi tasdig'i boshqarma tasdig'idan oldin turadi."""

    def setUp(self):
        self.pm = make_user(Role.PM)
        self.dept = make_user(Role.DEPARTMENT)
        self.dev = make_user(Role.DEVELOPER)
        r = client_for(self.dept).post(
            "/api/orders/",
            {"title": "Portal", "description": "Izoh", "requested_due_date": str(future(30)), "file": docx("tz.docx")},
            format="multipart",
        )
        order_id = r.data["id"]
        pm = client_for(self.pm)
        pm.post(f"/api/orders/{order_id}/approve/", dates(14), format="json")
        self.pid = pm.post(
            "/api/projects/", {"code": "ACKORD-1", "order": order_id, "member_ids": [self.dev.pk]}, format="json"
        ).data["id"]

    def test_dev_ack_then_department_approval(self):
        pm = client_for(self.pm)
        r = pm.patch(f"/api/projects/{self.pid}/", {"stage": "done"}, format="json")
        self.assertEqual(r.status_code, 200, r.data)
        self.assertEqual(r.data["stage"], "planned")
        self.assertIsNotNone(r.data["completion"])

        r2 = client_for(self.dev).post(f"/api/projects/{self.pid}/completion-ack/", {"confirmed": True}, format="json")
        self.assertEqual(r2.status_code, 200, r2.data)

        r3 = pm.get(f"/api/projects/{self.pid}/")
        self.assertEqual(r3.data["stage"], "planned")
        self.assertIn("done", r3.data["stage_targets"])
        self.assertFalse(r3.data["actions"]["add_task"])
        self.assertFalse(Notification.objects.filter(recipient=self.dept, kind="project_completion_requested").exists())
        finished = pm.patch(f"/api/projects/{self.pid}/", {"stage": "done"}, format="json")
        self.assertEqual(finished.status_code, 200, finished.data)
        self.assertEqual(finished.data["stage"], "pending_approval")
        order_id = Project.objects.get(pk=self.pid).order_id
        order = client_for(self.dept).get(f"/api/orders/{order_id}/").data
        self.assertTrue(order["actions"]["decide_completion"])
        self.assertTrue(Notification.objects.filter(recipient=self.dept, kind="project_completion_requested").exists())

        r4 = client_for(self.dept).post(f"/api/projects/{self.pid}/confirm-completion/")
        self.assertEqual(r4.status_code, 200, r4.data)
        self.assertEqual(Project.objects.get(pk=self.pid).stage, "done")


class ProjectListOrderTests(TestCase):
    """Ro'yxat Count bilan annotatsiya qilinadi — tartib aniq berilmasa sahifalashda yozuvlar takrorlanishi mumkin."""

    def test_list_is_newest_first_across_pages(self):
        from datetime import timedelta

        from django.utils import timezone

        pm = make_user(Role.PM)
        now = timezone.now()
        ids = []
        for i in range(55):  # PAGE_SIZE = 50 — ikki sahifa
            p = Project.objects.create(code=f"ORD-{i}", name=f"P{i}", created_by=pm, **dates())
            Project.objects.filter(pk=p.pk).update(created_at=now + timedelta(minutes=i))  # id tartibiga teskari
            ids.append(p.pk)
        client = client_for(pm)
        page1 = client.get("/api/projects/").data
        page2 = client.get("/api/projects/?page=2").data
        self.assertEqual([p["id"] for p in page1["results"] + page2["results"]], ids[::-1])
