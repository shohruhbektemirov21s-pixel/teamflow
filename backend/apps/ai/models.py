from django.conf import settings
from django.db import models


class WebAgentRun(models.Model):
    """TeamFlow foydalanuvchisi boshlagan, TinyFish'da bajarilayotgan ish."""

    class ProviderKind(models.TextChoices):
        AUTOMATION = "automation", "Sayt avtomatizatsiyasi"
        RESEARCH = "research", "Web tadqiqot"

    class Status(models.TextChoices):
        PENDING = "pending", "Kutilmoqda"
        RUNNING = "running", "Bajarilmoqda"
        COMPLETED = "completed", "Tugallangan"
        FAILED = "failed", "Xatolik"

    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="web_agent_runs")
    task = models.TextField("Vazifa", max_length=2000)
    url = models.URLField("Boshlang'ich URL", blank=True, null=True)
    provider_kind = models.CharField("TinyFish turi", max_length=16, choices=ProviderKind.choices)
    provider_run_id = models.CharField("TinyFish run ID", max_length=120, unique=True)
    status = models.CharField("Holat", max_length=16, choices=Status.choices, default=Status.PENDING)
    result = models.JSONField("Natija", null=True, blank=True)
    error = models.CharField("Xato", max_length=500, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        indexes = [models.Index(fields=["created_by", "-created_at"], name="ai_wr_user_created_ix")]

    def __str__(self):
        return f"{self.provider_kind}:{self.provider_run_id}"
