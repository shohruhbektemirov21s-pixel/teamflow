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
        TASK_ASSIGNED = "task_assigned", "Topshiriq berildi"
        TASK_SUBMITTED = "task_submitted", "Tekshiruvga yuborildi"
        TASK_ACCEPTED = "task_accepted", "Topshiriq qabul qilindi"
        TASK_RETURNED = "task_returned", "Topshiriq qaytarildi"
        TASK_SUBMIT_ACK_REQUESTED = "task_submit_ack_requested", "Tekshiruvga yuborishga tasdiq so'raldi"
        TASK_SUBMIT_ACK_REJECTED = "task_submit_ack_rejected", "Tekshiruvga yuborish rad etildi"
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
        indexes = [models.Index(fields=["recipient", "is_read"])]
        verbose_name = "Bildirishnoma"
        verbose_name_plural = "Bildirishnomalar"

    def __str__(self):
        return f"{self.recipient}: {self.message}"
