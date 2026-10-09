"""Akkaunt amallari: profil rasmi."""
from django.core.files.base import ContentFile
from django.db import transaction
from django.utils import timezone

from apps.core.api_utils import ServiceError
from apps.core.images import normalize_image
from apps.core.services import log

from .models import Role

AVATAR_MAX_MB = 5
AVATAR_SIZE = 1024  # px, eng uzun tomoni — katta ko'rinishda (rasm oynasi) ham tiniq


@transaction.atomic
def set_responsibilities(actor, employee, text):
    if not actor.is_manager:
        raise ServiceError("Mas'uliyatlarni faqat Boshliq yoki PM tahrirlaydi.")
    employee = type(employee).objects.select_for_update().get(pk=employee.pk)
    if not employee.is_active or not employee.role or (not actor.is_boss and not employee.is_developer):
        raise ServiceError("Bu xodimni tahrirlashga ruxsat yo'q.")
    text = text.strip()
    if len(text) > 2000:
        raise ServiceError("Mas'uliyatlar 2000 belgidan oshmasligi kerak.", "responsibilities")
    if employee.responsibilities != text:
        employee.responsibilities = text
        employee.save(update_fields=["responsibilities"])
        log(actor, "responsibilities_updated", f"{actor.full_name} {employee.full_name}ning mas'uliyatlarini yangiladi", employee)
    return employee


def set_avatar(user, upload):
    """Rasm `core.images.normalize_image` bilan tekshiriladi va JPEG qilinadi. Eski rasm o'chiriladi."""
    data = normalize_image(upload, max_side=AVATAR_SIZE, max_mb=AVATAR_MAX_MB, field="avatar")
    old = user.avatar.name
    user.avatar.save("avatar.jpg", ContentFile(data), save=False)
    user.save(update_fields=["avatar"])
    if old:
        user.avatar.storage.delete(old)
    return user


def remove_avatar(user):
    if user.avatar:
        user.avatar.delete(save=False)
        user.save(update_fields=["avatar"])
    return user


@transaction.atomic
def set_business_trip(actor, employee, return_date):
    if not actor.is_boss:
        raise ServiceError("Xizmat safarini faqat boshliq belgilaydi.")
    if not employee.is_active or employee.role not in (Role.PM, Role.DEVELOPER):
        raise ServiceError("Faqat faol xodimni xizmat safariga chiqarish mumkin.")
    if return_date <= timezone.localdate():
        raise ServiceError("Qaytish sanasi bugundan keyin bo'lishi kerak.", "return_date")
    employee = type(employee).objects.select_for_update().get(pk=employee.pk)
    employee.business_trip_return_date = return_date
    employee.save(update_fields=["business_trip_return_date"])
    log(actor, "business_trip_set", f"{actor.full_name} {employee.full_name}ni {return_date} gacha xizmat safariga chiqardi", employee)
    return employee


@transaction.atomic
def end_business_trip(actor, employee):
    if not actor.is_boss:
        raise ServiceError("Xizmat safarini faqat boshliq tugatadi.")
    employee = type(employee).objects.select_for_update().get(pk=employee.pk)
    if employee.business_trip_return_date is not None:
        employee.business_trip_return_date = None
        employee.save(update_fields=["business_trip_return_date"])
        log(actor, "business_trip_ended", f"{actor.full_name} {employee.full_name}ning xizmat safarini tugatdi", employee)
    return employee
