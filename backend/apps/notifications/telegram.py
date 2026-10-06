"""Telegram Bot API bilan ishlash — BITTA joyda (yuborish va chat_id ni bog'lash).

Token `settings.TELEGRAM_BOT_TOKEN` dan; bo'sh bo'lsa hech narsa yuborilmaydi.
"""
import logging

import requests
from django.conf import settings
from django.contrib.auth import get_user_model

logger = logging.getLogger(__name__)

TIMEOUT = 5  # soniya: Telegram javob bermasa ishchi oqim osilib qolmasin
POLL_TIMEOUT = 30  # getUpdates uzun so'rovi


def api_url(method):
    return f"https://api.telegram.org/bot{settings.TELEGRAM_BOT_TOKEN}/{method}"


def enabled():
    return bool(settings.TELEGRAM_BOT_TOKEN)


def send_message(chat_id, text):
    """Bitta xabar. Xato bo'lsa log yoziladi, istisno tashqariga chiqmaydi."""
    try:
        response = requests.post(api_url("sendMessage"), json={"chat_id": chat_id, "text": text}, timeout=TIMEOUT)
        response.raise_for_status()
        return True
    except requests.RequestException as exc:
        # Xato matnida URL (demak token) bo'lishi mumkin — logga faqat turi/holat kodi yoziladi
        reason = getattr(getattr(exc, "response", None), "status_code", None) or type(exc).__name__
        logger.warning("Telegram xabari yuborilmadi (chat_id=%s): %s", chat_id, reason)
        return False


def send_many(pairs):
    """[(chat_id, text), ...] — ketma-ket yuboriladi (fon oqimida chaqiriladi)."""
    for chat_id, text in pairs:
        send_message(chat_id, text)


def link_chat(username, chat_id):
    """Botga /start yozgan Telegram foydalanuvchisini tizimdagi akkauntga bog'laydi. Javob matnini qaytaradi.

    Tizimda `telegram_username` "@" bilan saqlanadi (ro'yxatdan o'tishda qo'shiladi), Telegram esa "@" siz beradi.
    """
    if not username:
        return "Telegram profilingizda username yo'q. Sozlamalardan username qo'ying va /start ni qayta yuboring."
    matches = list(get_user_model().objects.filter(telegram_username__iexact=f"@{username.lstrip('@')}"))
    if not matches:
        return "Bu Telegram username tizimda topilmadi. Ro'yxatdan o'tishda yozgan username'ingizni tekshiring."
    if len(matches) > 1:
        return "Bu username bir nechta akkauntda yozilgan. Administratorga murojaat qiling."
    user = matches[0]
    if not user.is_active:
        return "Akkauntingiz hali tasdiqlanmagan. Administrator tasdiqlagach /start ni qayta yuboring."
    user.telegram_chat_id = str(chat_id)
    user.save(update_fields=["telegram_chat_id"])
    return f"Xush kelibsiz, {user.full_name}! Endi TeamFlow bildirishnomalari shu yerga keladi."


def handle_update(update):
    """getUpdates dagi bitta yangilanish. /start bo'lsa (chat_id, javob), aks holda None."""
    message = update.get("message") or {}
    if not (message.get("text") or "").startswith("/start"):
        return None
    chat_id = message["chat"]["id"]
    username = (message.get("from") or {}).get("username")
    return chat_id, link_chat(username, chat_id)
