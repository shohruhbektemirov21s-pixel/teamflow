"""Synthetic data only in an explicitly named isolated load-test database."""
import json
import secrets
import random
from datetime import timedelta
from pathlib import Path

from django.conf import settings
from django.contrib.auth import BACKEND_SESSION_KEY, HASH_SESSION_KEY, SESSION_KEY
from django.contrib.sessions.backends.db import SessionStore
from django.contrib.sessions.models import Session
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from django.utils import timezone

from apps.accounts.models import Role, User
from apps.chat.models import ChatMessage
from apps.notifications.models import Notification
from apps.orders.models import Order
from apps.projects.models import Project, ProjectMember
from apps.tasks.models import SubTask, Task, TaskAssignment


class Command(BaseCommand):
    help = "Seed 10000 synthetic users in teamflow_scale only. Never uses the live SQLite database."

    def add_arguments(self, parser):
        parser.add_argument("--users", type=int, default=10000)
        parser.add_argument("--output", required=True)

    def handle(self, *args, **options):
        if not settings.SCALE_TEST_MODE or connection.vendor != "postgresql" or connection.settings_dict["NAME"] != "teamflow_scale":
            raise CommandError("Requires SCALE_TEST_MODE=1 and the isolated PostgreSQL database teamflow_scale.")
        if User.objects.exists():
            raise CommandError("Load-test database must be empty. This command never overwrites existing users.")
        size = options["users"]
        if not 100 <= size <= 20000:
            raise CommandError("Use between 100 and 20000 synthetic users.")
        now = timezone.now()
        pm_end, dept_end = max(2, size // 20), max(3, size * 15 // 100)
        with transaction.atomic():
            users = []
            for i in range(size):
                role = Role.BOSS if i == 0 else Role.PM if i < pm_end else Role.DEPARTMENT if i < dept_end else Role.DEVELOPER
                users.append(User(username=f"scale_{i:05d}", password="!load-test-no-login",
                                  first_name=f"Synthetic{i:05d}", last_name="Test", role=role, is_active=True,
                                  department_name=f"Synthetic department {i}" if role == Role.DEPARTMENT else ""))
            User.objects.bulk_create(users, batch_size=1000)
            developers = users[dept_end:]
            managers = users[1:pm_end]
            departments = users[pm_end:dept_end]
            orders = [Order(title=f"Synthetic order {i}", description="Load-test data",
                            submitted_by=u, requested_due_date=now.date() + timedelta(days=30))
                      for i, u in enumerate(departments)]
            Order.objects.bulk_create(orders, batch_size=1000)
            project_count = max(20, size // 5)
            projects = [Project(code=f"SCALE-{i}", name=f"Synthetic project {i}",
                                created_by=managers[i % len(managers)], stage="started",
                                start_date=now.date(), end_date=now.date() + timedelta(days=i % 30))
                        for i in range(project_count)]
            Project.objects.bulk_create(projects, batch_size=1000)
            tasks, memberships, active_task = [], set(), {}
            for i in range(size * 5):
                dev = developers[i % len(developers)]
                project = projects[i % len(projects)]
                status = ("in_progress", "control", "in_review", "done")[i % 4]
                tasks.append(Task(code=str(700000000 + i), title=f"Synthetic task {i}",
                                  project=project, created_by=project.created_by, status=status,
                                  due_at=now + timedelta(days=i % 30 - 3),
                                  completed_at=now if status == "done" else None))
                memberships.add((project.pk, dev.pk))
            Task.objects.bulk_create(tasks, batch_size=1000)
            assignments = []
            for i, task in enumerate(tasks):
                dev = developers[i % len(developers)]
                assignments.append(TaskAssignment(task=task, developer=dev))
                if task.status != "done":
                    active_task.setdefault(dev.pk, task.pk)
            TaskAssignment.objects.bulk_create(assignments, batch_size=1000)
            ProjectMember.objects.bulk_create([ProjectMember(project_id=p, developer_id=d) for p, d in memberships], batch_size=1000)
            SubTask.objects.bulk_create([SubTask(task=task, title="Synthetic step", position=0) for task in tasks], batch_size=1000)
            Notification.objects.bulk_create([
                Notification(recipient=u, kind="comment", message="Synthetic notification")
                for u in users for _ in range(5)
            ], batch_size=1000)
            ChatMessage.objects.bulk_create([
                ChatMessage(author=dev, recipient=developers[(i + 1) % len(developers)], text="Synthetic message")
                for i, dev in enumerate(developers)
            ], batch_size=1000)
            sessions, fixtures = [], []
            for i, user in enumerate(users):
                store = SessionStore()
                session_key = secrets.token_hex(16)
                session_data = {SESSION_KEY: str(user.pk), BACKEND_SESSION_KEY: "django.contrib.auth.backends.ModelBackend",
                                HASH_SESSION_KEY: user.get_session_auth_hash()}
                sessions.append(Session(session_key=session_key, session_data=store.encode(session_data), expire_date=now + timedelta(hours=2)))
                task_id = active_task.get(user.pk)
                if user.is_manager:
                    task_id = tasks[i % len(tasks)].pk
                fixtures.append({"id": user.pk, "role": user.role, "session": session_key,
                                 "task": task_id, "partner": developers[(i - dept_end + 1) % len(developers)].pk if user.is_developer else None})
            Session.objects.bulk_create(sessions, batch_size=1000)
        output = Path(options["output"])
        random.Random(20261006).shuffle(fixtures)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(json.dumps(fixtures), encoding="utf-8")
        self.stdout.write(self.style.SUCCESS(f"Created {size} synthetic users, {project_count} projects, {len(tasks)} tasks and sessions."))
