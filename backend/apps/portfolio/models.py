"""Dasturchi portfoliosi: loyihalar (TeamFlow'dagi va o'zi qo'shgan), videolar, baholar va kuzatuvchilar.

Bog'liqlik yo'nalishi: portfolio → accounts, projects, tasks (pastki qatlamlar portfolio'ni import qilmaydi).
"""
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator, URLValidator
from django.db import models
from django.db.models import F, Q

from apps.core.files import UploadTo

from .files import validate_video


class PortfolioItem(models.Model):
    """Portfoliodagi bitta loyiha.

    `project` bo'lsa — TeamFlow loyihasi (avtomatik paydo bo'ladi, nomi va sanalari loyihadan olinadi);
    bo'lmasa — dasturchi o'zi qo'shgan loyiha (nomi va sanalari shu yerda).
    """

    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="portfolio_items")
    project = models.ForeignKey("projects.Project", on_delete=models.CASCADE, null=True, blank=True,
                                related_name="portfolio_items")
    title = models.CharField("Nomi", max_length=255, blank=True)
    description = models.TextField("Tavsif", max_length=2000, blank=True)
    link = models.URLField("Havola", max_length=500, blank=True, validators=[URLValidator(schemes=["http", "https"])])
    start_date = models.DateField("Boshlanish", null=True, blank=True)
    end_date = models.DateField("Tugash", null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at", "-id"]
        constraints = [
            models.UniqueConstraint(fields=["owner", "project"], condition=Q(project__isnull=False),
                                    name="uniq_portfolio_owner_project"),
        ]
        verbose_name = "Portfolio loyihasi"
        verbose_name_plural = "Portfolio loyihalari"

    def clean(self):
        super().clean()
        if self.project_id is None and not self.title.strip():
            raise ValidationError({"title": "Loyiha nomi majburiy."})
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValidationError({"end_date": "Tugash sanasi boshlanish sanasidan oldin bo'lishi mumkin emas."})

    @property
    def is_auto(self):
        return self.project_id is not None

    @property
    def display_title(self):
        return self.project.name if self.project_id else self.title

    @property
    def period(self):
        if self.project_id:
            return self.project.start_date, self.project.end_date
        return self.start_date, self.end_date

    def __str__(self):
        return self.display_title


class PortfolioVideo(models.Model):
    item = models.ForeignKey(PortfolioItem, on_delete=models.CASCADE, related_name="videos")
    file = models.FileField(upload_to=UploadTo("portfolio/videos"), validators=[validate_video])
    original_name = models.CharField("Asl fayl nomi", max_length=255)
    # Baytlarda; dasturchining umumiy video kvotasi shundan hisoblanadi (diskka murojaat qilmasdan).
    size = models.PositiveBigIntegerField("Hajmi", default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at", "id"]
        verbose_name = "Portfolio videosi"
        verbose_name_plural = "Portfolio videolari"

    def __str__(self):
        return self.original_name


class PortfolioReview(models.Model):
    """Loyihaga baho (1–5 yulduz) va sharh. Bitta foydalanuvchi bitta loyihaga bitta baho (yangilash mumkin)."""

    item = models.ForeignKey(PortfolioItem, on_delete=models.CASCADE, related_name="reviews")
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="portfolio_reviews")
    stars = models.PositiveSmallIntegerField("Yulduz", validators=[MinValueValidator(1), MaxValueValidator(5)])
    text = models.TextField("Sharh", max_length=1000, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at", "-id"]
        constraints = [
            models.UniqueConstraint(fields=["item", "author"], name="uniq_portfolio_review"),
            models.CheckConstraint(condition=Q(stars__gte=1, stars__lte=5), name="portfolio_review_stars_1_5"),
        ]
        verbose_name = "Baho va sharh"
        verbose_name_plural = "Baholar va sharhlar"

    def __str__(self):
        return f"{self.author}: {self.stars}★"


class Follow(models.Model):
    """Foydalanuvchi dasturchini kuzatadi."""

    follower = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="following")
    developer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="followers")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["follower", "developer"], name="uniq_follow"),
            models.CheckConstraint(condition=~Q(follower=F("developer")), name="follow_not_self"),
        ]
        verbose_name = "Kuzatuvchi"
        verbose_name_plural = "Kuzatuvchilar"

    def __str__(self):
        return f"{self.follower} → {self.developer}"
