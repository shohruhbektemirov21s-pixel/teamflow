from django.test import TestCase

from apps.accounts.models import Role
from apps.orders.models import Order
from apps.panel.tests.factories import client_for, dates, docx, future, make_user
from apps.projects.models import Project


class ProjectTests(TestCase):
    def setUp(self):
        self.pm = make_user(Role.PM)
        self.boss = make_user(Role.BOSS)
        self.dev1 = make_user(Role.DEVELOPER)
        self.dev2 = make_user(Role.DEVELOPER)
        self.dept = make_user(Role.DEPARTMENT)

    def create(self, user=None, **kw):
        data = {"name": "Portal", "description": "Ichki portal", **dates(), "member_ids": [self.dev1.pk, self.dev2.pk]}
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

    def test_multipart_with_files(self):
        r = client_for(self.pm).post(
            "/api/projects/",
            {"name": "P", **dates(), "member_ids": f"[{self.dev1.pk}]", "files": [docx("a.docx"), docx("b.pdf")]},
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
        r = client_for(self.pm).post("/api/projects/", {"order": self.order_id}, format="json")
        self.assertEqual(r.status_code, 400)

    def test_create_from_order_copies_data_and_uses_pm_dates(self):
        pm = client_for(self.pm)
        pm_dates = dates(14)
        pm.post(f"/api/orders/{self.order_id}/approve/", pm_dates, format="json")
        r = pm.post("/api/projects/", {"order": self.order_id, "member_ids": [self.dev.pk]}, format="json")
        self.assertEqual(r.status_code, 201, r.data)
        self.assertEqual(r.data["name"], "Hisobot moduli")
        self.assertEqual(r.data["description"], "Oylik hisobot")
        self.assertEqual(r.data["start_date"], pm_dates["start_date"])
        self.assertEqual(r.data["end_date"], pm_dates["end_date"])
        self.assertEqual([f["name"] for f in r.data["files"]], ["tz.docx"])
        self.assertEqual(r.data["order"]["id"], self.order_id)
        self.assertEqual(Order.objects.get(pk=self.order_id).status, Order.Status.PROJECT_CREATED)
        # Ikkinchi marta yaratib bo'lmaydi
        self.assertEqual(pm.post("/api/projects/", {"order": self.order_id}, format="json").status_code, 400)

        # Buyurtmadan yaratilgan loyihada faqat sanalar o'zgaradi
        pid = r.data["id"]
        self.assertFalse(r.data["actions"]["edit_info"])
        self.assertEqual(pm.patch(f"/api/projects/{pid}/", {"name": "Boshqa"}, format="json").status_code, 400)
        new = dates(40)
        r = pm.patch(f"/api/projects/{pid}/", new, format="json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(Order.objects.get(pk=self.order_id).end_date.isoformat(), new["end_date"])
        # TZ fayli loyiha a'zosi dasturchiga ham ochiladi
        url = r.data["files"][0]["url"]
        self.assertEqual(client_for(self.dev).get(url).status_code, 200)
        self.assertEqual(Project.objects.count(), 1)


class ProjectListOrderTests(TestCase):
    """Ro'yxat Count bilan annotatsiya qilinadi — tartib aniq berilmasa sahifalashda yozuvlar takrorlanishi mumkin."""

    def test_list_is_newest_first_across_pages(self):
        from datetime import timedelta

        from django.utils import timezone

        pm = make_user(Role.PM)
        now = timezone.now()
        ids = []
        for i in range(55):  # PAGE_SIZE = 50 — ikki sahifa
            p = Project.objects.create(name=f"P{i}", created_by=pm, **dates())
            Project.objects.filter(pk=p.pk).update(created_at=now + timedelta(minutes=i))  # id tartibiga teskari
            ids.append(p.pk)
        client = client_for(pm)
        page1 = client.get("/api/projects/").data
        page2 = client.get("/api/projects/?page=2").data
        self.assertEqual([p["id"] for p in page1["results"] + page2["results"]], ids[::-1])
