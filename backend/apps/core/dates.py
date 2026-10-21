"""Muddat sanalari qoidasi — BITTA joyda: bugungi kundan oldingi sana kiritilmaydi (bugun va keyingi kunlar mumkin).

Faqat yangi kiritilgan yoki o'zgartirilgan qiymat tekshiriladi: eski yozuvdagi o'tib ketgan sana o'zgarmasa,
boshqa maydonlarni (nom, izoh) saqlashga xalaqit bermaydi. Filtrlar va tarixiy sanalar (portfolio, ish jurnali)
bu qoidaga kirmaydi.
"""
from datetime import datetime

from django.utils import timezone

from .api_utils import ServiceError

PAST_DATE_MESSAGE = "Bugungi kundan oldingi sanani tanlab bo'lmaydi."


def _local(value):
    if isinstance(value, datetime) and timezone.is_aware(value):
        return timezone.localtime(value)
    return value


def _same(value, previous):
    """Forma eski qiymatni daqiqa aniqligida qaytaradi — soniyalar farqi "o'zgarish" hisoblanmaydi."""
    if previous is None:
        return False
    value, previous = _local(value), _local(previous)
    if isinstance(value, datetime) and isinstance(previous, datetime):
        return value.replace(second=0, microsecond=0) == previous.replace(second=0, microsecond=0)
    return value == previous


def ensure_not_past(value, field, previous=None):
    """`value` bugundan oldin bo'lsa ServiceError (maydon yonida xato). `previous` — saqlangan eski qiymat."""
    if value is None or _same(value, previous):
        return
    day = _local(value)
    day = day.date() if isinstance(day, datetime) else day
    if day < timezone.localdate():
        raise ServiceError(PAST_DATE_MESSAGE, field)
