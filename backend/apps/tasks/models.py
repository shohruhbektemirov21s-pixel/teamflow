from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.utils import timezone

from apps.core.choices import Priority
from apps.core.codes import generate_unique_code
from apps.core.files import UploadTo, validate_upload


class Task(models.Model):
    """Vazifa. Bitta vazifa bir nechta dasturchiga biriktirilishi mumkin."""

    class Status(models.TextChoices):
        CONTROL = "control", "Nazoratda"
        IN_PROGRESS = "in_progress", "Jarayonda"
        IN_REVIEW = "in_review", "Tekshiruvda"
        DONE = "done", "Bajarildi"

    project = models.ForeignKey("projects.Project", on_delete=models.PROTECT, related_name="tasks")
    code = models.CharField("Kod", max_length=9, unique=True, editable=False)
    title = models.CharField("Nomi", max_length=255)
    description = models.TextField("Izoh", blank=True)
    priority = models.CharField("Muhimlik", max_length=16, choices=Priority.choices, default=Priority.MEDIUM)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.CONTROL, db_index=True)
    starts_at = models.DateTimeField("Boshlanish vaqti", null=True, blank=True)
    due_at = models.DateTimeField("Tugash vaqti (muddat)", null=True, blank=True, db_index=True)
    completed_at = models.DateTimeField("Bajarilgan vaqt", null=True, blank=True)
    archived_at = models.DateTimeField("Arxivlangan vaqt", null=True, blank=True, db_index=True)
    # Menejer (PM/Boshliq) ijrochi bo'lmay "Tekshiruvga yuborish" bossa, shu paytdagi izoh shu yerda kutadi —
    # ijrochilar tasdiqlagach haqiqiy Submission shundan yaratiladi (TaskSubmitAck/TaskSubmitAttachment).
    submit_requested_at = models.DateTimeField("Tekshiruvga yuborish tasdig'i so'ralgan payt", null=True, blank=True)
    submit_requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+",
        verbose_name="Tekshiruvga yuborishni so'ragan menejer",
    )
    pending_submit_note = models.TextField("Kutilayotgan izoh", blank=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    assignees = models.ManyToManyField(
        settings.AUTH_USER_MODEL, through="TaskAssignment", related_name="assigned_tasks", verbose_name="Ijrochilar"
    )

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Topshiriq"
        verbose_name_plural = "Topshiriqlar"

    def clean(self):
        super().clean()
        if self.starts_at and self.due_at and self.due_at < self.starts_at:
            raise ValidationError({"due_at": "Tugash vaqti boshlanish vaqtidan oldin bo'lishi mumkin emas."})

    def save(self, *args, **kwargs):
        if not self.code:
            self.code = generate_unique_code()
        super().save(*args, **kwargs)

    # Hisoblanadigan qiymatlar saqlanmaydi (holatdan kelib chiqadi).
    @property
    def is_overdue(self):
        return bool(self.archived_at is None and self.due_at and self.status != self.Status.DONE and self.due_at < timezone.now())

    @property
    def finished_late(self):
        return bool(self.due_at and self.completed_at and self.completed_at > self.due_at)

    def __str__(self):
        return self.title


class TaskAssignment(models.Model):
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="assignments")
    developer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="task_assignments")
    assigned_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["task", "developer"], name="uniq_task_assignment")]
        verbose_name = "Topshiriq ijrochisi"
        verbose_name_plural = "Topshiriq ijrochilari"

    def clean(self):
        super().clean()
        if self.developer_id and not self.developer.is_developer:
            raise ValidationError({"developer": "Topshiriq faqat 'Dasturchi' rolidagi foydalanuvchiga biriktiriladi."})

    def __str__(self):
        return f"{self.task} — {self.developer}"


class TaskSubmitAck(models.Model):
    """Menejer (PM/Boshliq) ijrochi bo'lmay vazifani tekshiruvga yubormoqchi bo'lsa so'ralgan ijrochi tasdig'i
    (bir davr = bitta so'rov turi). Birortasi rad etsa, butun davr bekor qilinadi; qayta so'raganda
    hammadan yangidan so'raladi (ProjectCompletionAck namunasida)."""

    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="submit_acks")
    developer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="+")
    confirmed = models.BooleanField("Tasdiqladi", null=True, default=None)
    reason = models.CharField("Rad etish sababi", max_length=500, blank=True)
    decided_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["task", "developer"], name="uniq_task_submit_ack")]
        verbose_name = "Tekshiruvga yuborish tasdig'i"
        verbose_name_plural = "Tekshiruvga yuborish tasdiqlari"

    def __str__(self):
        return f"{self.task} — {self.developer}"


class TaskSubmitAttachment(models.Model):
    """Menejer so'ragan tekshiruvga yuborish uchun kutilayotgan fayl — tasdiqlangach `SubmissionFile`ga ko'chadi."""

    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="submit_attachments")
    file = models.FileField(upload_to=UploadTo("tasks/submit_attachments"), validators=[validate_upload])
    original_name = models.CharField("Asl fayl nomi", max_length=255)

    class Meta:
        verbose_name = "Kutilayotgan tekshiruv fayli"
        verbose_name_plural = "Kutilayotgan tekshiruv fayllari"

    def __str__(self):
        return self.original_name


class SubTask(models.Model):
    """Vazifa ichidagi kichik qadam; unga bir nechta dasturchi biriktirish mumkin."""

    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="subtasks")
    title = models.CharField("Nomi", max_length=255)
    assignees = models.ManyToManyField(
        settings.AUTH_USER_MODEL, blank=True, related_name="assigned_subtasks", verbose_name="Ijrochilar"
    )
    is_done = models.BooleanField("Bajarildi", default=False)
    position = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["position", "id"]
        verbose_name = "Sub-vazifa"
        verbose_name_plural = "Sub-vazifalar"

    def __str__(self):
        return self.title


class TaskFile(models.Model):
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="files")
    file = models.FileField(upload_to=UploadTo("tasks/files"), validators=[validate_upload])
    original_name = models.CharField("Asl fayl nomi", max_length=255)
    uploaded_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        verbose_name = "Topshiriq fayli"
        verbose_name_plural = "Topshiriq fayllari"

    def __str__(self):
        return self.original_name


class Submission(models.Model):
    """Tekshiruvga topshirish: dasturchi nima qilganini yozadi, PM qabul qiladi yoki qaytaradi."""

    class Decision(models.TextChoices):
        PENDING = "pending", "Ko'rib chiqilmoqda"
        ACCEPTED = "accepted", "Qabul qilindi"
        RETURNED = "returned", "Qaytarildi"

    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="submissions")
    round = models.PositiveIntegerField("Urinish raqami", default=1)
    submitted_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="+")
    note = models.TextField("Nima qilindi")
    decision = models.CharField(max_length=16, choices=Decision.choices, default=Decision.PENDING, db_index=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    review_note = models.TextField("Tekshiruvchi izohi", blank=True)
    submitted_at = models.DateTimeField(auto_now_add=True)
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["round"]
        constraints = [models.UniqueConstraint(fields=["task", "round"], name="uniq_task_submission_round")]
        verbose_name = "Topshirish"
        verbose_name_plural = "Topshirishlar (tekshiruv)"

    def __str__(self):
        return f"{self.task} — {self.round}-urinish"


class SubmissionFile(models.Model):
    submission = models.ForeignKey(Submission, on_delete=models.CASCADE, related_name="files")
    file = models.FileField(upload_to=UploadTo("tasks/submissions"), validators=[validate_upload])
    original_name = models.CharField("Asl fayl nomi", max_length=255)

    class Meta:
        verbose_name = "Topshirish fayli"
        verbose_name_plural = "Topshirish fayllari"

    def __str__(self):
        return self.original_name


class WorkLog(models.Model):
    task = models.ForeignKey(Task, on_delete=models.CASCADE, related_name="worklogs")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="worklogs")
    work_date = models.DateField("Ish sanasi")
    hours = models.DecimalField("Sarflangan soat", max_digits=4, decimal_places=2)
    note = models.TextField("Bajarilgan ish")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-work_date", "-created_at", "-pk"]
        constraints = [models.CheckConstraint(condition=models.Q(hours__gt=0, hours__lte=24), name="worklog_hours_range")]
