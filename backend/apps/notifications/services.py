import threading
import requests
from django.conf import settings
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
    for item in items:
        if getattr(item.recipient, "telegram_chat_id", None):
            threading.Thread(target=send_telegram_message, args=(item.recipient.telegram_chat_id, item.message)).start()
    return items


def managers():
    """Barcha faol PM va Boshliqlar."""
    return get_user_model().objects.filter(is_active=True, role__in=[Role.PM, Role.BOSS])

def send_telegram_message(chat_id, message):
    token = getattr(settings, "TELEGRAM_BOT_TOKEN", None)
    if not token or token == "dummy_token_for_testing":
        return
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    try:
        requests.post(url, json={"chat_id": chat_id, "text": message})
    except:
        pass
