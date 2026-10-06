"""Real vaqt hodisalari (WebSocket). Har foydalanuvchining o'z guruhi bor: `user.<id>`.

Hodisada **ma'lumot yuborilmaydi** — faqat "nima o'zgardi" belgisi (`{"type": "notification"}`).
Frontend tegishli ro'yxatni oddiy REST so'rovi bilan qayta oladi, shuning uchun ruxsat qoidalari
faqat bitta joyda (REST API) qoladi va WebSocket orqali begona ma'lumot chiqib ketmaydi.

Hodisalar tranzaksiya muvaffaqiyatli tugagach yuboriladi (amal bekor bo'lsa, hodisa ham yo'q).
Real vaqt ishlamasa ham asosiy amal buzilmaydi — xato faqat logga yoziladi.
"""
import logging

from asgiref.sync import async_to_sync
from channels.layers import get_channel_layer
from django.db import transaction

logger = logging.getLogger(__name__)


def user_group(user_id):
    return f"user.{user_id}"


def _send(user_ids, payload):
    layer = get_channel_layer()
    if layer is None:
        return

    async def send_all():  # bitta event loop — har foydalanuvchi uchun alohida sync↔async o'tish yo'q
        for user_id in user_ids:
            await layer.group_send(user_group(user_id), {"type": "event", "payload": payload})

    try:
        async_to_sync(send_all)()
    except Exception:  # Redis vaqtincha ishlamasa — amal davom etadi, mijoz zaxira so'rov bilan yangilanadi
        logger.warning("Real vaqt hodisasi yuborilmadi: %s", payload.get("type"), exc_info=True)


def publish(user_ids, payload):
    """`user_ids` ga hodisa — joriy tranzaksiya tugagach. Takroriy id bir marta."""
    ids = sorted({uid for uid in user_ids if uid})
    if ids:
        transaction.on_commit(lambda: _send(ids, payload))
