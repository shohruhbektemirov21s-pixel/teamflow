from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("tasks", "0007_alter_task_code_not_null"),
    ]

    operations = [
        migrations.AlterField(
            model_name="task",
            name="project",
            field=models.ForeignKey(on_delete=models.PROTECT, related_name="tasks", to="projects.project"),
        ),
        migrations.AddField(
            model_name="task",
            name="archived_at",
            field=models.DateTimeField(blank=True, db_index=True, null=True, verbose_name="Arxivlangan vaqt"),
        ),
    ]
