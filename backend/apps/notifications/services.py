import threading

from django.contrib.auth import get_user_model
from django.db import transaction
from django.conf import settings
from django.utils import timezone

from apps.accounts.models import Role

from . import telegram
from .models import Notification, TelegramDelivery


def notify(recipients, kind, message, target=None, exclude=None):
    """Bir nechta foydalanuvchiga bildirishnoma. Takrorlar va `exclude` (odatda amalni bajaruvchi) chiqarib tashlanadi.

    Production: Telegram outbox yozuvi bildirishnoma bilan bitta tranzaksiyada yaratiladi.
    Development: on_commit orqali fon oqimi yuboradi. Amal bekor bo'lsa xabar ham ketmaydi.
    """
    with transaction.atomic():
        return _notify(recipients, kind, message, target, exclude)


def _notify(recipients, kind, message, target, exclude):
    seen = set()
    items = []
    for user in recipients:
        if user is None or user.pk in seen or (exclude is not None and user.pk == exclude.pk):
            continue
        seen.add(user.pk)
        items.append(Notification(recipient=user, kind=kind, message=message[:255], target=target))
    Notification.objects.bulk_create(items)

    pairs = [(item.recipient.telegram_chat_id, item.message) for item in items if item.recipient.telegram_chat_id]
    if pairs and telegram.enabled():
        if settings.TELEGRAM_DELIVERY_MODE == "outbox":
            TelegramDelivery.objects.bulk_create([
                TelegramDelivery(chat_id=chat_id, text=text, available_at=timezone.now())
                for chat_id, text in pairs
            ])
        else:
            transaction.on_commit(
                lambda: threading.Thread(target=telegram.send_many, args=(pairs,), daemon=True).start()
            )
    return items


def managers():
    """Barcha faol PM va Boshliqlar."""
    return get_user_model().objects.filter(is_active=True, role__in=[Role.PM, Role.BOSS])
