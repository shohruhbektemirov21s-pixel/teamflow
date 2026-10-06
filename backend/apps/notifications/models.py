from django.conf import settings
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType
from django.db import models


class Notification(models.Model):
    """Bildirishnoma: foydalanuvchiga yo'naltirilgan, bosilganda tegishli modalni ochadi."""

    class Kind(models.TextChoices):
        ORDER_SUBMITTED = "order_submitted", "Yangi buyurtma"
        ORDER_APPROVED = "order_approved", "Buyurtma tasdiqlandi"
        ORDER_REJECTED = "order_rejected", "Buyurtma rad etildi"
        ORDER_RESUBMITTED = "order_resubmitted", "Yangi TZ versiyasi"
        TASK_ASSIGNED = "task_assigned", "Vazifa berildi"
        TASK_SUBMITTED = "task_submitted", "Tekshiruvga yuborildi"
        TASK_ACCEPTED = "task_accepted", "Vazifa qabul qilindi"
        TASK_RETURNED = "task_returned", "Vazifa qaytarildi"
        COMMENT = "comment", "Yangi izoh"
        PROJECT_COMPLETION_ACK_REQUESTED = "project_completion_ack_requested", "Loyihani yakunlashga tasdiq so'raldi"
        PROJECT_COMPLETION_ACK_REJECTED = "project_completion_ack_rejected", "Dasturchi yakunlashni rad etdi"
        PROJECT_COMPLETION_ACK_DONE = "project_completion_ack_done", "Barcha dasturchilar tasdiqladi"
        PROJECT_COMPLETION_REQUESTED = "project_completion_requested", "Loyihani yakunlashni tasdiqlash so'raldi"
        PROJECT_COMPLETION_APPROVED = "project_completion_approved", "Loyihani yakunlash tasdiqlandi"
        PROJECT_COMPLETION_REJECTED = "project_completion_rejected", "Loyihani yakunlash rad etildi"

    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications")
    kind = models.CharField(max_length=32, choices=Kind.choices)
    message = models.CharField(max_length=255)
    target_type = models.ForeignKey(ContentType, on_delete=models.CASCADE, null=True, blank=True)
    target_id = models.PositiveBigIntegerField(null=True, blank=True)
    target = GenericForeignKey("target_type", "target_id")
    is_read = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["recipient", "is_read"]),
            # Ro'yxat: o'z bildirishnomalari yangisidan eskisiga (sahifalash) — saralashsiz indeksdan o'qiladi
            models.Index(fields=["recipient", "-created_at"], name="notif_recipient_created_idx"),
        ]
        verbose_name = "Bildirishnoma"
        verbose_name_plural = "Bildirishnomalar"

    def __str__(self):
        return f"{self.recipient}: {self.message}"
