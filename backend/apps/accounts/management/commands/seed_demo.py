"""Demo ma'lumotlar: har bir roldan foydalanuvchi, loyiha, vazifalar, buyurtma.

Faqat DEBUG=1 da ishlaydi. Qayta ishga tushirilsa, mavjud yozuvlar takrorlanmaydi.
Barcha demo foydalanuvchilar paroli: Demo-parol-2026
"""
from datetime import timedelta

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from apps.accounts.models import Role, Specialty, User

PASSWORD = "Demo-parol-2026"
SPECIALTIES = ["Backend dasturchi", "Frontend dasturchi", "Mobil dasturchi", "Dizayner", "Tester",
               "Loyiha menejeri", "Boshqaruv"]


class Command(BaseCommand):
    help = "Demo ma'lumotlarni yaratadi (faqat DEBUG rejimida)."

    def handle(self, *args, **options):
        if not settings.DEBUG:
            raise CommandError("seed_demo faqat DEBUG=1 rejimida ishlaydi.")
        from apps.orders import services as orders
        from apps.projects import services as projects
        from apps.tasks import services as tasks

        spec = {name: Specialty.objects.get_or_create(name=name)[0] for name in SPECIALTIES}

        def user(username, first, last, role, specialty, **kw):
            u, created = User.objects.get_or_create(
                username=username,
                defaults={"first_name": first, "last_name": last, "role": role, "specialty": spec[specialty], **kw},
            )
            if created:
                u.set_password(PASSWORD)
                u.save()
            return u

        boss = user("boshliq", "Akmal", "Karimov", Role.BOSS, "Boshqaruv")
        pm = user("pm", "Sardor", "Rustamov", Role.PM, "Loyiha menejeri")
        dev1 = user("jasur", "Jasur", "Alimov", Role.DEVELOPER, "Backend dasturchi")
        dev2 = user("malika", "Malika", "Karimova", Role.DEVELOPER, "Frontend dasturchi")
        user("bobur", "Bobur", "Rahimov", Role.DEVELOPER, "Mobil dasturchi")
        dept = user("it_boshqarma", "Shoxrux", "Hamidov", Role.DEPARTMENT, "Boshqaruv",
                    department_name="Axborot texnologiyalari boshqarmasi")

        from apps.projects.models import Project
        if Project.objects.filter(name="TeamFlow ichki portal").exists():
            self.stdout.write(self.style.WARNING("Demo ma'lumotlar allaqachon bor."))
            return

        today = timezone.localdate()
        now = timezone.now()
        project = projects.create_project(
            pm, name="TeamFlow ichki portal", description="Xodimlar uchun ichki portal",
            start_date=today - timedelta(days=20), end_date=today + timedelta(days=40),
            member_ids=[dev1.pk, dev2.pk], stage="started",
        )
        t1 = tasks.create_task(pm, project, title="Kirish sahifasini yaratish",
                               description="Login va parolni tiklash formasi", priority="high",
                               due_at=now + timedelta(days=2), assignee_ids=[dev1.pk, dev2.pk],
                               subtasks=[{"title": "Forma dizayni", "assignee_ids": [dev2.pk]},
                                         {"title": "API ulash", "assignee_ids": [dev1.pk]}])
        tasks.start_task(t1, dev1)
        t2 = tasks.create_task(pm, project, title="Telegram bot orqali eslatma", priority="medium",
                               due_at=now - timedelta(days=1), assignee_ids=[dev1.pk])
        tasks.start_task(t2, dev1)
        tasks.submit_task(t2, dev1, note="Bot eslatmalarni yuboradi, sinovdan o'tkazildi.")
        tasks.create_task(pm, project, title="Hisobotlar sahifasi", priority="low",
                          due_at=now + timedelta(days=7), assignee_ids=[dev2.pk])

        order = orders.create_order(dept, title="Hujjat aylanishi tizimi",
                                    description="Kiruvchi va chiquvchi hujjatlarni ro'yxatga olish",
                                    priority="urgent", requested_due_date=today + timedelta(days=45),
                                    file=ContentFile(b"demo", name="TZ-hujjat-aylanishi.docx"))
        self.stdout.write(self.style.SUCCESS(
            f"Tayyor. Loginlar: boshliq, pm, jasur, malika, bobur, it_boshqarma. Parol: {PASSWORD}. "
            f"Buyurtma #{order.pk} tasdiqlanishini kutmoqda."
        ))
