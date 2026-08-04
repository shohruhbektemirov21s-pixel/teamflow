from django.test import TestCase

from apps.accounts.models import Role
from apps.notifications.models import Notification
from apps.orders.models import Order
from apps.panel.tests.factories import client_for, dates, docx, future, make_user


class OrderFlowTests(TestCase):
    def setUp(self):
        self.dept = make_user(Role.DEPARTMENT)
        self.other_dept = make_user(Role.DEPARTMENT)
        self.pm = make_user(Role.PM)
        self.boss = make_user(Role.BOSS)
        self.dev = make_user(Role.DEVELOPER)

    def submit(self, user=None):
        return client_for(user or self.dept).post(
            "/api/orders/",
            {"title": "CRM tizimi", "description": "Tezroq", "priority": "urgent",
             "requested_due_date": str(future(20)), "file": docx()},
            format="multipart",
        )

    def test_department_submits_and_managers_notified(self):
        r = self.submit()
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["status"], "submitted")
        self.assertEqual(r.data["versions"][0]["number"], 1)
        self.assertEqual(r.data["submitted_by"]["department_name"], self.dept.department_name)
        recipients = set(Notification.objects.filter(kind="order_submitted").values_list("recipient", flat=True))
        self.assertEqual(recipients, {self.pm.pk, self.boss.pk})

    def test_only_department_can_submit(self):
        for user in (self.pm, self.dev, self.boss):
            self.assertEqual(self.submit(user).status_code, 403)

    def test_bad_file_type_rejected(self):
        r = client_for(self.dept).post(
            "/api/orders/",
            {"title": "X", "requested_due_date": str(future()), "file": docx("virus.exe")},
            format="multipart",
        )
        self.assertEqual(r.status_code, 400)

    def test_visibility(self):
        oid = self.submit().data["id"]
        self.assertEqual(client_for(self.other_dept).get(f"/api/orders/{oid}/").status_code, 404)
        self.assertEqual(client_for(self.dev).get(f"/api/orders/{oid}/").status_code, 404)
        self.assertEqual(client_for(self.other_dept).get("/api/orders/").data["count"], 0)
        self.assertEqual(client_for(self.pm).get(f"/api/orders/{oid}/").status_code, 200)
        self.assertEqual(client_for(self.boss).get(f"/api/orders/{oid}/").status_code, 200)

    def test_department_cannot_edit_or_delete(self):
        oid = self.submit().data["id"]
        c = client_for(self.dept)
        self.assertEqual(c.patch(f"/api/orders/{oid}/", {"title": "Y"}, format="json").status_code, 405)
        self.assertEqual(c.delete(f"/api/orders/{oid}/").status_code, 405)

    def test_no_new_version_while_pending(self):
        oid = self.submit().data["id"]
        r = client_for(self.dept).post(f"/api/orders/{oid}/versions/", {"file": docx(), "note": "x"},
                                       format="multipart")
        self.assertEqual(r.status_code, 400)

    def test_reject_then_resubmit(self):
        oid = self.submit().data["id"]
        pm = client_for(self.pm)
        self.assertEqual(pm.post(f"/api/orders/{oid}/reject/", {"reason": ""}, format="json").status_code, 400)
        r = pm.post(f"/api/orders/{oid}/reject/", {"reason": "Kirish sahifasi yo'q"}, format="json")
        self.assertEqual(r.data["status"], "rejected")
        self.assertEqual(r.data["versions"][0]["reject_reason"], "Kirish sahifasi yo'q")
        self.assertTrue(Notification.objects.filter(recipient=self.dept, kind="order_rejected").exists())

        dept = client_for(self.dept)
        d = dept.get(f"/api/orders/{oid}/").data
        self.assertTrue(d["actions"]["new_version"])
        self.assertFalse(d["actions"]["approve"])
        # Boshqa boshqarma versiya yubora olmaydi (ko'rinmaydi)
        r = client_for(self.other_dept).post(f"/api/orders/{oid}/versions/", {"file": docx(), "note": "x"},
                                             format="multipart")
        self.assertEqual(r.status_code, 404)
        # Tuzatish izohi majburiy
        r = dept.post(f"/api/orders/{oid}/versions/", {"file": docx(), "note": ""}, format="multipart")
        self.assertEqual(r.status_code, 400)
        r = dept.post(f"/api/orders/{oid}/versions/", {"file": docx("tz2.docx"), "note": "Kirish qo'shildi"},
                      format="multipart")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(r.data["status"], "submitted")
        self.assertEqual([v["number"] for v in r.data["versions"]], [1, 2])

    def test_approve_requires_valid_dates_and_sets_responsible_pm(self):
        oid = self.submit().data["id"]
        pm = client_for(self.pm)
        bad = {"start_date": str(future(5)), "end_date": str(future(1))}
        self.assertEqual(pm.post(f"/api/orders/{oid}/approve/", bad, format="json").status_code, 400)
        r = pm.post(f"/api/orders/{oid}/approve/", {**dates(), "note": "Boshlaymiz"}, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.data["status"], "approved")
        self.assertEqual(r.data["approved_by"]["id"], self.pm.pk)
        self.assertTrue(r.data["actions"]["create_project"])
        self.assertEqual(r.data["versions"][0]["decision"], "approved")

    def test_department_cannot_approve(self):
        oid = self.submit().data["id"]
        r = client_for(self.dept).post(f"/api/orders/{oid}/approve/", dates(), format="json")
        self.assertEqual(r.status_code, 403)

    def test_cannot_approve_twice(self):
        oid = self.submit().data["id"]
        pm = client_for(self.pm)
        pm.post(f"/api/orders/{oid}/approve/", dates(), format="json")
        self.assertEqual(pm.post(f"/api/orders/{oid}/approve/", dates(), format="json").status_code, 400)
        self.assertEqual(pm.post(f"/api/orders/{oid}/reject/", {"reason": "x"}, format="json").status_code, 400)

    def test_file_download_permission(self):
        d = self.submit().data
        url = d["versions"][0]["file"]["url"]
        self.assertEqual(client_for(self.dept).get(url).status_code, 200)
        self.assertEqual(client_for(self.pm).get(url).status_code, 200)
        self.assertEqual(client_for(self.other_dept).get(url).status_code, 404)
        self.assertEqual(client_for(self.dev).get(url).status_code, 404)

    def test_order_dates_change_only_after_approval(self):
        oid = self.submit().data["id"]
        pm = client_for(self.pm)
        self.assertEqual(pm.post(f"/api/orders/{oid}/dates/", dates(3), format="json").status_code, 400)
        pm.post(f"/api/orders/{oid}/approve/", dates(), format="json")
        r = pm.post(f"/api/orders/{oid}/dates/", dates(30), format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(Order.objects.get(pk=oid).end_date.isoformat(), dates(30)["end_date"])
