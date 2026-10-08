"""Video yozuvi qaysi yo'l bilan o'chirilmasin (o'zi, loyiha, foydalanuvchi — CASCADE), fayli diskda qolmaydi.
Fayl tranzaksiya tasdiqlangandan keyin o'chiriladi: amal bekor bo'lsa, video yo'qolmaydi."""
from django.db import transaction
from django.db.models.signals import post_delete
from django.dispatch import receiver

from .models import PortfolioVideo


@receiver(post_delete, sender=PortfolioVideo)
def delete_video_file(sender, instance, **kwargs):
    if instance.file:
        storage, name = instance.file.storage, instance.file.name
        transaction.on_commit(lambda: storage.delete(name))
