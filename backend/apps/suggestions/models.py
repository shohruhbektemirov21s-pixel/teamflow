from django.conf import settings
from django.db import models

class Suggestion(models.Model):
    """Xodim taklifi. Anonim bo'lsa author=None."""

    class Status(models.TextChoices):
        PENDING = "pending", "Ko'rib chiqilmoqda"
        ACCEPTED = "accepted", "Qabul qilingan"
        REJECTED = "rejected", "Rad etilgan"

    title = models.CharField("Sarlavha", max_length=255)
    body = models.TextField("Taklif matni")
    is_anonymous = models.BooleanField("Anonim", default=False)
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="suggestions"
    )
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.PENDING, db_index=True)
    boss_note = models.TextField("Boshliq izohi", blank=True)
    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    decided_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Taklif"
        verbose_name_plural = "Takliflar"

    def __str__(self):
        return self.title


class SuggestionVote(models.Model):
    """Ovoz berish: yoqdi (FOR) yoki qarshi (AGAINST)."""

    class Kind(models.TextChoices):
        FOR = "for", "Yoqlaydi"
        AGAINST = "against", "Qarshi"

    suggestion = models.ForeignKey(Suggestion, on_delete=models.CASCADE, related_name="votes")
    voter = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="+")
    kind = models.CharField(max_length=8, choices=Kind.choices)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["suggestion", "voter"], name="uniq_suggestion_vote")]
        verbose_name = "Ovoz"
        verbose_name_plural = "Ovozlar"

    def __str__(self):
        return f"{self.voter}: {self.kind}"
