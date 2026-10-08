"""Video yozuvi qaysi yo'l bilan o'chirilmasin (o'zi, loyiha, foydalanuvchi — CASCADE), fayli diskda qolmaydi.
Fayl tranzaksiya tasdiqlangandan keyin o'chiriladi: amal bekor bo'lsa, video yo'qolmaydi.

Dasturchi jamoadan chiqarilsa — portfolio yozuvi `services.membership_removed` qoidasi bilan yangilanadi
(projects app portfolio'ni import qilmaydi, shuning uchun signal orqali)."""
from django.db import transaction
from django.db.models.signals import post_delete
from django.dispatch import receiver

from apps.projects.models import ProjectMember

from . import services
from .models import PortfolioVideo


@receiver(post_delete, sender=PortfolioVideo)
def delete_video_file(sender, instance, **kwargs):
    if instance.file:
        storage, name = instance.file.storage, instance.file.name
        transaction.on_commit(lambda: storage.delete(name))


@receiver(post_delete, sender=ProjectMember)
def forget_removed_member(sender, instance, **kwargs):
    # Tasdiqdan keyin: shu tranzaksiyada ochiq vazifalar ham olib tashlanadi (projects.services._release_developers)
    owner_id, project_id = instance.developer_id, instance.project_id
    transaction.on_commit(lambda: services.membership_removed(owner_id, project_id))
