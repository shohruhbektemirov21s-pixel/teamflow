from django.conf import settings
from django.db import models

from apps.core.choices import Priority
from apps.core.files import UploadTo, validate_upload


class Order(models.Model):
    """Buyurtma — boshqarma yuboradi, PM tasdiqlaydi yoki rad etadi."""

    class Status(models.TextChoices):
        SUBMITTED = "submitted", "Yuborilgan"
        APPROVED = "approved", "Tasdiqlangan"
        REJECTED = "rejected", "Rad etilgan"
        PROJECT_CREATED = "project_created", "Loyiha yaratilgan"

    # Boshqarma kiritadi (yuborilgach o'zgartirilmaydi)
    title = models.CharField("Nomi", max_length=255)
    description = models.TextField("Qisqacha izoh", blank=True)
    priority = models.CharField("Muhimlik", max_length=16, choices=Priority.choices, default=Priority.MEDIUM)
    requested_due_date = models.DateField("Boshqarma so'ragan muddat")
    submitted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="submitted_orders"
    )

    status = models.CharField(max_length=20, choices=Status.choices, default=Status.SUBMITTED, db_index=True)

    # PM tasdiqlaganda kiritadi
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name="approved_orders"
    )
    start_date = models.DateField("PM belgilagan boshlanish", null=True, blank=True)
    end_date = models.DateField("PM belgilagan tugash", null=True, blank=True)
    pm_note = models.TextField("PM izohi", blank=True)
    decided_at = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Buyurtma"
        verbose_name_plural = "Buyurtmalar (TZ)"

    def __str__(self):
        return self.title

    @property
    def latest_version(self):
        return self.versions.order_by("-number").first()


class OrderVersion(models.Model):
    """TZ versiyasi. Rad etilsa, boshqarma yangi versiya (v2, v3…) yuboradi."""

    class Decision(models.TextChoices):
        PENDING = "pending", "Ko'rib chiqilmoqda"
        APPROVED = "approved", "Tasdiqlangan"
        REJECTED = "rejected", "Rad etilgan"

    order = models.ForeignKey(Order, on_delete=models.CASCADE, related_name="versions")
    number = models.PositiveIntegerField("Versiya")
    file = models.FileField(upload_to=UploadTo("orders/tz"), validators=[validate_upload])
    original_name = models.CharField("Asl fayl nomi", max_length=255)
    note = models.TextField("Nima tuzatildi", blank=True)  # v2+ da boshqarma kamchiliklarni yozadi
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    decision =models.CharField(max_length=16, choices=Decision.choices, default=Decision.PENDING)
    reject_reason = models.TextField("Rad etish sababi", blank=True)
    decided_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    decided_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["number"]
        constraints = [models.UniqueConstraint(fields=["order", "number"], name="uniq_order_version_number")]
        verbose_name = "TZ versiyasi"
        verbose_name_plural = "TZ versiyalari"

    def __str__(self):
        return f"{self.order_id} — v{self.number}"
