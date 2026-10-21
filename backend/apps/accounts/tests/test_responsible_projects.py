from django.test import TestCase
from rest_framework.test import APIClient

from apps.accounts.models import ResponsibleProject, ResponsibleProjectNews, Role
from apps.core.models import ActivityLog
from apps.panel.tests.factories import client_for, make_user


class ResponsibleProjectTests(TestCase):
    def setUp(self):
        self.boss = make_user(Role.BOSS)
        self.pm = make_user(Role.PM)
        self.dev = make_user(Role.DEVELOPER)
        self.other_dev = make_user(Role.DEVELOPER)
        self.url = f"/api/people/{self.dev.pk}/responsible-projects/"

    def create(self, actor=None, employee=None, **data):
        employee = employee or self.dev
        payload = {"name": "Ichki portal", "description": "Kadrlar bo'limi uchun", **data}
        return client_for(actor or self.pm).post(f"/api/people/{employee.pk}/responsible-projects/", payload, format="json")

    def test_boss_and_pm_add_edit_and_delete_projects(self):
        for actor in (self.boss, self.pm):
            res = self.create(actor, name="  Kadrlar portali  ", description="  Izoh  ")
            self.assertEqual(res.status_code, 201)
            self.assertEqual((res.data["name"], res.data["description"], res.data["news_count"]), ("Kadrlar portali", "Izoh", 0))
            pk = res.data["id"]
            res = client_for(actor).patch(f"/api/responsible-projects/{pk}/", {"name": "Yangi nom"}, format="json")
            self.assertEqual(res.status_code, 200)
            self.assertEqual((res.data["name"], res.data["description"]), ("Yangi nom", ""))
            self.assertEqual(client_for(actor).delete(f"/api/responsible-projects/{pk}/").status_code, 204)
        self.assertFalse(ResponsibleProject.objects.exists())
        self.assertEqual(ActivityLog.objects.filter(verb__startswith="responsible_project_").count(), 6)

    def test_list_shows_flags_and_news_stats(self):
        project_id = self.create().data["id"]
        client_for(self.dev).post(f"/api/responsible-projects/{project_id}/news/", {"text": "API tayyor"}, format="json")
        manager_view = client_for(self.pm).get(self.url).data
        self.assertEqual((manager_view["can_manage"], manager_view["can_post"]), (True, True))
        self.assertEqual(manager_view["projects"][0]["news_count"], 1)
        self.assertIsNotNone(manager_view["projects"][0]["last_news_at"])
        own_view = client_for(self.dev).get(self.url).data
        self.assertEqual((own_view["can_manage"], own_view["can_post"]), (True, True))
        self.assertEqual(len(own_view["projects"]), 1)

    def test_developer_adds_edits_and_deletes_own_projects(self):
        c = client_for(self.dev)
        created = c.post(self.url, {"name": "  O'zim  ", "description": "Izoh"}, format="json")
        self.assertEqual((created.status_code, created.data["name"]), (201, "O'zim"))
        pk = created.data["id"]
        self.assertEqual(c.patch(f"/api/responsible-projects/{pk}/", {"name": "Yangi nom"}, format="json").status_code, 200)
        self.assertEqual(ResponsibleProject.objects.get().name, "Yangi nom")
        self.assertEqual(c.delete(f"/api/responsible-projects/{pk}/").status_code, 204)
        self.assertFalse(ResponsibleProject.objects.exists())

    def test_developer_cannot_touch_other_employees_projects(self):
        mine = self.create().data["id"]  # PM self.dev uchun kiritdi
        other = self.create(employee=self.other_dev).data["id"]
        c = client_for(self.dev)
        # boshqa dasturchining loyihalari — ko'rinmaydi (404), o'zgartirib ham bo'lmaydi
        self.assertEqual(c.post(f"/api/people/{self.other_dev.pk}/responsible-projects/", {"name": "X"}, format="json").status_code, 404)
        self.assertEqual(c.patch(f"/api/responsible-projects/{other}/", {"name": "X"}, format="json").status_code, 404)
        self.assertEqual(c.delete(f"/api/responsible-projects/{other}/").status_code, 404)
        self.assertEqual(ResponsibleProject.objects.get(pk=other).name, "Ichki portal")
        self.assertEqual(c.patch(f"/api/responsible-projects/{mine}/", {"name": "Meniki"}, format="json").status_code, 200)

    def test_outsiders_get_404_and_anonymous_is_rejected(self):
        project_id = self.create().data["id"]
        outsiders = [self.other_dev, make_user(Role.DEPARTMENT), make_user(Role.USER)]
        for actor in outsiders:
            c = client_for(actor)
            self.assertEqual(c.get(self.url).status_code, 404)
            self.assertEqual(c.post(self.url, {"name": "X"}, format="json").status_code, 404)
            self.assertEqual(c.get(f"/api/responsible-projects/{project_id}/news/").status_code, 404)
            self.assertEqual(c.post(f"/api/responsible-projects/{project_id}/news/", {"text": "X"}, format="json").status_code, 404)
            self.assertEqual(c.delete(f"/api/responsible-projects/{project_id}/").status_code, 404)
        self.assertIn(APIClient().get(self.url).status_code, [401, 403])
        self.assertFalse(ResponsibleProjectNews.objects.exists())

    def test_target_rules_match_people_profile(self):
        # Boshliq — PM ga ham kiritadi; PM boshqa PM ga — yo'q; nofaol va boshqarma xodimiga — hech kim.
        self.assertEqual(self.create(self.boss, employee=self.pm).status_code, 201)
        self.assertEqual(self.create(self.pm, employee=make_user(Role.PM)).status_code, 404)
        self.assertEqual(self.create(self.boss, employee=make_user(Role.DEPARTMENT)).status_code, 404)
        self.assertEqual(self.create(self.boss, employee=self.boss).status_code, 404)
        self.dev.is_active = False
        self.dev.save(update_fields=["is_active"])
        self.assertEqual(self.create(self.boss).status_code, 404)
        # PM o'z mas'ul loyihasini ko'radi va yangilik yozadi, lekin o'zgartira olmaydi (faqat dasturchi o'zinikini boshqaradi)
        own = client_for(self.pm).get(f"/api/people/{self.pm.pk}/responsible-projects/").data
        self.assertEqual((own["can_manage"], len(own["projects"])), (False, 1))

    def test_news_by_employee_and_managers_newest_first(self):
        project_id = self.create().data["id"]
        news_url = f"/api/responsible-projects/{project_id}/news/"
        for actor, text in [(self.dev, "  Dizayn tayyor  "), (self.pm, "Muddat ko'chdi"), (self.boss, "Rahmat")]:
            res = client_for(actor).post(news_url, {"text": text}, format="json")
            self.assertEqual(res.status_code, 201)
            self.assertEqual((res.data["text"], res.data["author"]["id"]), (text.strip(), actor.pk))
        rows = client_for(self.dev).get(news_url).data["results"]
        self.assertEqual([r["text"] for r in rows], ["Rahmat", "Muddat ko'chdi", "Dizayn tayyor"])

    def test_validation(self):
        for data in ({"name": ""}, {"name": "   "}, {"name": "x" * 256}, {"description": "x" * 1001}):
            self.assertEqual(self.create(**data).status_code, 400)
        project_id = self.create().data["id"]
        news_url = f"/api/responsible-projects/{project_id}/news/"
        for payload in ({}, {"text": ""}, {"text": "   "}, {"text": "x" * 2001}):
            self.assertEqual(client_for(self.dev).post(news_url, payload, format="json").status_code, 400)
        self.assertEqual(client_for(self.dev).post(news_url, {"text": "x" * 2000}, format="json").status_code, 201)
        # Ortiqcha maydonlar (xodim, muallif) e'tiborga olinmaydi
        res = self.create(name="Boshqa", employee_id=self.other_dev.pk, created_by=self.boss.pk)
        self.assertEqual(ResponsibleProject.objects.get(pk=res.data["id"]).employee, self.dev)

    def test_people_list_shows_and_searches_project_names(self):
        self.create(name="Kadrlar portali")
        rows = client_for(self.pm).get("/api/people/").data
        self.assertEqual(next(p for p in rows if p["id"] == self.dev.pk)["responsible_projects"], ["Kadrlar portali"])
        found = client_for(self.pm).get("/api/people/", {"q": "kadrlar"}).data
        self.assertEqual([p["id"] for p in found], [self.dev.pk])
        self.assertEqual(client_for(self.pm).get(f"/api/people/{self.dev.pk}/").data["responsible_projects"], ["Kadrlar portali"])
