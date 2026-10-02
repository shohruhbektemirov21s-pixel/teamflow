from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("projects", "0004_backfill_project_codes"),
    ]

    operations = [
        migrations.AlterField(
            model_name="project",
            name="code",
            field=models.CharField(editable=False, max_length=9, unique=True, verbose_name="Kod"),
        ),
    ]
