"""Mavjud vazifalarga tasodifiy 9 xonali kod beradi (loyiha kodlari bilan to'qnashmaydi)."""
import random

from django.db import migrations

CODE_LENGTH = 9


def _random_digits():
    return "".join(str(random.randint(0, 9)) for _ in range(CODE_LENGTH))


def backfill(apps, schema_editor):
    Task = apps.get_model("tasks", "Task")
    Project = apps.get_model("projects", "Project")
    used = set(Project.objects.exclude(code__isnull=True).values_list("code", flat=True))
    for task in Task.objects.filter(code__isnull=True):
        while True:
            candidate = _random_digits()
            if candidate not in used and not Task.objects.filter(code=candidate).exists():
                used.add(candidate)
                task.code = candidate
                task.save(update_fields=["code"])
                break


def noop(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("tasks", "0005_task_code"),
        ("projects", "0003_project_code"),
    ]

    operations = [
        migrations.RunPython(backfill, noop),
    ]
