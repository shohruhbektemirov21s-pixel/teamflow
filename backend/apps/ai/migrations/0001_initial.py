# Generated manually for TeamFlow's TinyFish web-agent integration.
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [migrations.swappable_dependency(settings.AUTH_USER_MODEL)]

    operations = [
        migrations.CreateModel(
            name="WebAgentRun",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("task", models.TextField(max_length=2000, verbose_name="Vazifa")),
                ("url", models.URLField(blank=True, null=True, verbose_name="Boshlang'ich URL")),
                ("provider_kind", models.CharField(choices=[("automation", "Sayt avtomatizatsiyasi"), ("research", "Web tadqiqot")], max_length=16, verbose_name="TinyFish turi")),
                ("provider_run_id", models.CharField(max_length=120, unique=True, verbose_name="TinyFish run ID")),
                ("status", models.CharField(choices=[("pending", "Kutilmoqda"), ("running", "Bajarilmoqda"), ("completed", "Tugallangan"), ("failed", "Xatolik")], default="pending", max_length=16, verbose_name="Holat")),
                ("result", models.JSONField(blank=True, null=True, verbose_name="Natija")),
                ("error", models.CharField(blank=True, max_length=500, verbose_name="Xato")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("created_by", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="web_agent_runs", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-created_at", "-id"]},
        ),
        migrations.AddIndex(
            model_name="webagentrun",
            index=models.Index(fields=["created_by", "-created_at"], name="ai_wr_user_created_ix"),
        ),
    ]
