from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from apps.core.files import UploadTo, validate_upload


class Project(models.Model):
    """Loyiha. Faqat PM va Boshliq yaratadi."""

    class Stage(models.TextChoices):
        PLANNED = "planned", "Rejalashtirilgan"
        STARTED = "started", "Boshlangan"
        NEEDS_FIX = "needs_fix", "Tuzatish kerak"
        REJECTED = "rejected", "Rad etildi"
        PENDING_APPROVAL = "pending_approval", "Tasdiqlash kutilmoqda"
        DONE = "done", "Yakunlangan"

    code = models.CharField("Loyiha raqami", max_length=32, unique=True)
    name = models.CharField("Nomi", max_length=255)
    description = models.TextField("Izoh", blank=True)
    order = models.OneToOneField(
        "orders.Order",
        verbose_name="Buyurtma",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="project",
    )
    stage = models.CharField("Daraja", max_length=16, choices=Stage.choices, default=Stage.PLANNED, db_index=True)
    start_date = models.DateField("Boshlanish sanasi")
    end_date = models.DateField("Tugash sanasi")
    # Yakunlashdan oldin dasturchilardan so'ralgan tasdiq davri boshlangan payt (null — faol so'rov yo'q).
    completion_requested_at = models.DateTimeField("Dasturchi tasdig'i so'ralgan payt", null=True, blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    members = models.ManyToManyField(
        settings.AUTH_USER_MODEL, through="ProjectMember", related_name="projects", verbose_name="Dasturchilar"
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Loyiha"
        verbose_name_plural = "Loyihalar"

    def clean(self):
        super().clean()
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValidationError({"end_date": "Tugash sanasi boshlanish sanasidan oldin bo'lishi mumkin emas."})

    def __str__(self):
        return self.name


class ProjectMember(models.Model):
    """Loyihaga biriktirilgan dasturchi."""

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="memberships")
    developer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="project_memberships"
    )
    added_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["project", "developer"], name="uniq_project_member")]
        verbose_name = "Loyiha a'zosi"
        verbose_name_plural = "Loyiha a'zolari"

    def clean(self):
        super().clean()
        if self.developer_id and not self.developer.is_developer:
            raise ValidationError({"developer": "Loyihaga faqat 'Dasturchi' rolidagi foydalanuvchi biriktiriladi."})

    def __str__(self):
        return f"{self.project} — {self.developer}"


class ProjectCompletionAck(models.Model):
    """Loyihani yakunlashdan oldin so'ralgan dasturchi tasdig'i (bir davr = bitta so'rov turi).

    PM/Boshliq "Yakunlangan"ni tanlaganda shu loyihadagi har bir faol dasturchiga bitta qator
    (confirmed=None, "kutilmoqda") yaratiladi. Dasturchi tasdiqlaganda/rad etganda shu qator
    to'ldiriladi. Birortasi rad etsa, butun davr bekor qilinadi (qatorlar o'chiriladi) — qayta
    so'ralganda hammadan yangidan so'raladi.
    """

    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="completion_acks")
    developer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="+")
    confirmed = models.BooleanField("Tasdiqladi", null=True, default=None)
    reason = models.CharField("Rad etish sababi", max_length=500, blank=True)
    decided_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["project", "developer"], name="uniq_project_completion_ack")]
        verbose_name = "Loyiha yakunlash tasdig'i"
        verbose_name_plural = "Loyiha yakunlash tasdiqlari"

    def __str__(self):
        return f"{self.project} — {self.developer}"


class ProjectFile(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="files")
    file = models.FileField(upload_to=UploadTo("projects/files"), validators=[validate_upload])
    original_name = models.CharField("Asl fayl nomi", max_length=255)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Loyiha fayli"
        verbose_name_plural = "Loyiha fayllari"

    def __str__(self):
        return self.original_name
