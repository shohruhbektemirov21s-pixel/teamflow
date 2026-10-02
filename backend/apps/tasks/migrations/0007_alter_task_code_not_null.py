from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tasks", "0006_backfill_task_codes"),
    ]

    operations = [
        migrations.AlterField(
            model_name="task",
            name="code",
            field=models.CharField(editable=False, max_length=9, unique=True, verbose_name="Kod"),
        ),
    ]
