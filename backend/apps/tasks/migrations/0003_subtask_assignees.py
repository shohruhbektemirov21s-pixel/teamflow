"""Sub-vazifa: bitta ijrochi (assignee) o'rniga bir nechta (assignees). Eski ijrochi yangi ro'yxatga ko'chiriladi."""
from django.conf import settings
from django.db import migrations, models


def copy_assignee(apps, schema_editor):
    SubTask = apps.get_model("tasks", "SubTask")
    for sub in SubTask.objects.exclude(assignee=None).only("id", "assignee_id"):
        sub.assignees.add(sub.assignee_id)


def restore_assignee(apps, schema_editor):
    SubTask = apps.get_model("tasks", "SubTask")
    for sub in SubTask.objects.prefetch_related("assignees"):
        first = next(iter(sub.assignees.all()), None)
        if first:
            sub.assignee_id = first.pk
            sub.save(update_fields=["assignee"])


class Migration(migrations.Migration):
    dependencies = [
        ("tasks", "0002_worklog"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="subtask",
            name="assignees",
            field=models.ManyToManyField(
                blank=True, related_name="assigned_subtasks", to=settings.AUTH_USER_MODEL, verbose_name="Ijrochilar"
            ),
        ),
        migrations.RunPython(copy_assignee, restore_assignee),
        migrations.RemoveField(model_name="subtask", name="assignee"),
    ]
