from django.contrib.auth import get_user_model

from apps.accounts.models import Role

from .models import Notification


def notify(recipients, kind, message, target=None, exclude=None):
    """Bir nechta foydalanuvchiga bildirishnoma. Takrorlar va `exclude` (odatda amalni bajaruvchi) chiqarib tashlanadi."""
    seen = set()
    items = []
    for user in recipients:
        if user is None or user.pk in seen or (exclude is not None and user.pk == exclude.pk):
            continue
        seen.add(user.pk)
        items.append(Notification(recipient=user, kind=kind, message=message[:255], target=target))
    Notification.objects.bulk_create(items)
    return items


def managers():
    """Barcha faol PM va Boshliqlar."""
    return get_user_model().objects.filter(is_active=True, role__in=[Role.PM, Role.BOSS])
