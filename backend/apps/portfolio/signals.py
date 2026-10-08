"""Video yozuvi qaysi yo'l bilan o'chirilmasin (o'zi, loyiha, foydalanuvchi — CASCADE), fayli diskda qolmaydi.
Fayl tranzaksiya tasdiqlangandan keyin o'chiriladi: amal bekor bo'lsa, video yo'qolmaydi."""
from django.db import transaction
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

from apps.projects.models import ProjectMember

from .models import PortfolioItem, PortfolioVideo
from .stats import invalidate_developer_ranking


@receiver(post_save, sender=ProjectMember)
def materialize_project_portfolio_item(sender, instance, created, **kwargs):
    if not created:
        return
    _, item_created = PortfolioItem.objects.get_or_create(owner_id=instance.developer_id, project_id=instance.project_id)
    if item_created:
        invalidate_developer_ranking()


@receiver(post_delete, sender=PortfolioVideo)
def delete_video_file(sender, instance, **kwargs):
    if instance.file:
        storage, name = instance.file.storage, instance.file.name
        transaction.on_commit(lambda: storage.delete(name))
