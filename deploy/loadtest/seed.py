"""Yuk testi uchun soxta ma'lumot — FAQAT sinov stendida. Amaldagi bazada ishga tushirmang.

    docker compose -f deploy/docker-compose.yml -f deploy/loadtest/docker-compose.loadtest.yml \
        run --rm seed

Yaratadi (`lt_` prefiksi bilan): LT_USERS dasturchi, 20 PM, 200 loyiha, har dasturchiga 5 vazifa,
20 bildirishnoma va 5 chat xabari — oxirgi 6 oyga taqsimlangan (oylik partitsiyalar ham to'ladi).
"""
import os
import random
from datetime import date, timedelta

from django.contrib.auth.hashers import make_password
from django.db import connection, transaction
from django.utils import timezone

from apps.accounts.models import Role, User
from apps.chat.models import ChatMessage
from apps.notifications.models import Notification
from apps.projects.models import Project, ProjectMember
from apps.tasks.models import Task, TaskAssignment

if os.environ.get("TEAMFLOW_LOADTEST") != "1":
    raise SystemExit("TEAMFLOW_LOADTEST=1 bo'lmasa ishlamaydi (faqat sinov stendi).")

N = int(os.environ.get("LT_USERS", "10000"))
PASSWORD = os.environ.get("LT_PASSWORD", "Loadtest-2026")
BATCH = 5000
random.seed(42)

if User.objects.filter(username__startswith="lt_").exists():
    raise SystemExit("Sinov ma'lumotlari allaqachon bor.")

hashed = make_password(PASSWORD)  # bitta xesh hammaga — 10 000 marta PBKDF2 hisoblanmaydi
now = timezone.now()

with transaction.atomic():
    pms = User.objects.bulk_create(
        [User(username=f"lt_pm_{i:02d}", first_name=f"PM{i}", last_name="Load", role=Role.PM, password=hashed)
         for i in range(20)]
    )
    devs = User.objects.bulk_create(
        [User(username=f"lt_dev_{i:05d}", first_name=f"Dev{i}", last_name="Load", role=Role.DEVELOPER, password=hashed)
         for i in range(N)],
        batch_size=BATCH,
    )
    projects = Project.objects.bulk_create(
        [Project(code=f"LT-{i}", name=f"Sinov loyihasi {i}", stage=Project.Stage.STARTED,
                 start_date=date.today() - timedelta(days=60), end_date=date.today() + timedelta(days=60),
                 created_by=pms[i % len(pms)]) for i in range(200)]
    )
    ProjectMember.objects.bulk_create(
        [ProjectMember(project=projects[i % len(projects)], developer=dev) for i, dev in enumerate(devs)],
        batch_size=BATCH,
    )
    statuses = [s.value for s in Task.Status]
    tasks, owners = [], []
    for i, dev in enumerate(devs):
        for k in range(5):
            n = len(tasks)
            tasks.append(Task(
                project=projects[i % len(projects)], code=str(800_000_000 + n), title=f"Vazifa {n}",
                status=random.choice(statuses), due_at=now + timedelta(days=random.randint(-30, 30)),
                created_by=pms[i % len(pms)],
            ))
            owners.append(dev)
    tasks = Task.objects.bulk_create(tasks, batch_size=BATCH)
    TaskAssignment.objects.bulk_create(
        [TaskAssignment(task=t, developer=d) for t, d in zip(tasks, owners)], batch_size=BATCH
    )
    Notification.objects.bulk_create(
        [Notification(recipient=dev, kind=Notification.Kind.TASK_ASSIGNED, message=f"Vazifa berildi {j}",
                      is_read=j > 2) for dev in devs for j in range(20)],
        batch_size=BATCH,
    )
    ChatMessage.objects.bulk_create(
        [ChatMessage(author=dev, recipient=random.choice(devs), text=f"Salom {j}") for dev in devs for j in range(5)],
        batch_size=BATCH,
    )
    # auto_now_add hammasiga "hozir" qo'ygan — 6 oyga taqsimlanadi (qatorlar o'z oyi partitsiyasiga ko'chadi)
    with connection.cursor() as cursor:
        for table in (Notification._meta.db_table, ChatMessage._meta.db_table):
            cursor.execute(f"UPDATE {table} SET created_at = now() - random() * interval '180 days'")

print(f"Tayyor: {N} dasturchi, {len(tasks)} vazifa, {N * 20} bildirishnoma, {N * 5} chat xabari. Parol: {PASSWORD}")
