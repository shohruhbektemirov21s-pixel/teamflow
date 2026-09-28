from django.contrib.auth.models import AbstractUser
from django.core.exceptions import ValidationError
from django.db import models


class Role(models.TextChoices):
    BOSS = "boss", "Boshliq"
    PM = "pm", "Loyiha menejeri"
    DEVELOPER = "developer", "Dasturchi"
    DEPARTMENT = "department", "Boshqarma"


class Specialty(models.Model):
    """Mutaxassislik — ro'yxatdan o'tish formasida tanlanadi, Django adminda boshqariladi."""

    name = models.CharField("Nomi", max_length=100, unique=True)
    is_active = models.BooleanField("Faol", default=True)

    class Meta:
        ordering = ["name"]
        verbose_name = "Mutaxassislik"
        verbose_name_plural = "Mutaxassisliklar"

    def __str__(self):
        return self.name


class User(AbstractUser):
    """Foydalanuvchi. Login — `username`.

    Ro'yxatdan o'tganlar `is_active=False` bilan yaratiladi (registratsiya servisi, 2-bosqich),
    administrator Django adminda faollashtiradi. Boshliq faqat adminda yaratiladi.
    """

    role = models.CharField("Rol", max_length=16, choices=Role.choices, blank=True)
    specialty = models.ForeignKey(
        Specialty,
        verbose_name="Mutaxassislik",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="users",
    )
    department_name = models.CharField("Boshqarma nomi", max_length=200, blank=True)
    telegram_chat_id = models.CharField(max_length=100, blank=True)
    telegram_username = models.CharField("Telegram", max_length=100, blank=True, help_text="Bildirishnomalar uchun, ms: @username")

    class Meta:
        verbose_name = "Foydalanuvchi"
        verbose_name_plural = "Foydalanuvchilar"

    def clean(self):
        super().clean()
        if self.role == Role.DEPARTMENT and not self.department_name.strip():
            raise ValidationError({"department_name": "Boshqarma uchun uning nomi majburiy."})
        if self.role and self.role != Role.DEPARTMENT and self.department_name:
            raise ValidationError({"department_name": "Boshqarma nomi faqat 'Boshqarma' roli uchun."})

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip() or self.username

    @property
    def is_boss(self):
        return self.role == Role.BOSS

    @property
    def is_pm(self):
        return self.role == Role.PM

    @property
    def is_developer(self):
        return self.role == Role.DEVELOPER

    @property
    def is_department(self):
        return self.role == Role.DEPARTMENT

    @property
    def is_manager(self):
        """PM va Boshliq — boshqaruv huquqlari bir xil (README, ruxsatlar jadvali)."""
        return self.role in (Role.PM, Role.BOSS)

    def __str__(self):
        return self.full_name
