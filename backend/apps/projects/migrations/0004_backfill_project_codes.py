"""Mavjud loyihalarga tasodifiy 9 xonali kod beradi (vazifa kodlari bilan to'qnashmaydi)."""
import random

from django.db import migrations

CODE_LENGTH = 9


def _random_digits():
    return "".join(str(random.randint(0, 9)) for _ in range(CODE_LENGTH))


def backfill(apps, schema_editor):
    Project = apps.get_model("projects", "Project")
    Task = apps.get_model("tasks", "Task")
    used = set(Task.objects.exclude(code__isnull=True).values_list("code", flat=True))
    for project in Project.objects.filter(code__isnull=True):
        while True:
            candidate = _random_digits()
            if candidate not in used and not Project.objects.filter(code=candidate).exists():
                used.add(candidate)
                project.code = candidate
                project.save(update_fields=["code"])
                break


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("projects", "0003_project_code"),
        ("tasks", "0006_backfill_task_codes"),
    ]

    operations = [
        migrations.RunPython(backfill, noop),
    ]
