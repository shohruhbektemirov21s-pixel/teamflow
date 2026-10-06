"""Claim a short lease; never hold database locks while doing network I/O."""
import uuid
from datetime import timedelta

from django.db import connection, transaction
from django.db.models import Q
from django.utils import timezone

from . import telegram
from .models import TelegramDelivery

MAX_ATTEMPTS = 6


def deliver_one():
    if not telegram.enabled():
        return False
    now = timezone.now()
    with transaction.atomic():
        qs = TelegramDelivery.objects.filter(sent_at__isnull=True, failed_at__isnull=True,
                                             available_at__lte=now).filter(
            Q(lease_until__isnull=True) | Q(lease_until__lt=now))
        qs = qs.select_for_update(skip_locked=connection.features.has_select_for_update_skip_locked)
        item = qs.order_by("available_at", "pk").first()
        if item is None:
            return False
        item.lease_token = uuid.uuid4().hex
        item.lease_until = now + timedelta(seconds=60)
        item.attempts += 1
        item.save(update_fields=["lease_token", "lease_until", "attempts"])
    success = telegram.send_message(item.chat_id, item.text)
    values = {"lease_token": "", "lease_until": None}
    if success:
        values["sent_at"] = timezone.now()
    elif item.attempts >= MAX_ATTEMPTS:
        values["failed_at"] = timezone.now()
    else:
        values["available_at"] = timezone.now() + timedelta(seconds=min(300, 2 ** item.attempts))
    TelegramDelivery.objects.filter(pk=item.pk, lease_token=item.lease_token).update(**values)
    return True
