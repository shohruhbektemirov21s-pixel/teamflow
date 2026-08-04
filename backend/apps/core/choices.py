from django.db import models


class Priority(models.TextChoices):
    LOW = "low", "Past"
    MEDIUM = "medium", "O'rtacha"
    HIGH = "high", "Yuqori"
    URGENT = "urgent", "Shoshilinch"
