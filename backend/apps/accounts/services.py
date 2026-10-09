"""Akkaunt amallari: profil rasmi."""
import io

from django.core.files.base import ContentFile
from django.db import transaction
from django.utils import timezone
from PIL import Image, ImageOps, UnidentifiedImageError
from rest_framework.exceptions import PermissionDenied

from apps.core.api_utils import ServiceError
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


def set_technologies(user, text):
    """Dasturchi o'z texnologiyalarini o'zi tahrirlaydi (portfolio kartasida va qidiruvda ko'rinadi)."""
    if not user.is_developer:
        raise PermissionDenied("Texnologiyalarni faqat dasturchi to'ldiradi.")
    text = text.strip()
    if text != user.technologies:
        user.technologies = text
        user.save(update_fields=["technologies"])
    return user


def set_avatar(user, upload):
    """Rasm Pillow bilan ochiladi (kengaytmaga ishonilmaydi), 1024px gacha kichraytiriladi va JPEG qilib qayta saqlanadi —
    EXIF (joylashuv va h.k.) o'chadi, rasm bo'lmagan fayl o'tmaydi. Eski rasm o'chiriladi."""
    if upload.size > AVATAR_MAX_MB * 1024 * 1024:
        raise ServiceError(f"Rasm hajmi {AVATAR_MAX_MB} MB dan oshmasligi kerak.", "avatar")
    try:
        image = Image.open(upload)
        if image.format not in ("JPEG", "PNG", "WEBP"):
            raise ServiceError("Faqat JPG, PNG yoki WEBP rasm yuklang.", "avatar")
        image = ImageOps.exif_transpose(image)
        image.thumbnail((AVATAR_SIZE, AVATAR_SIZE))
        if image.mode != "RGB":
            background = Image.new("RGB", image.size, "white")
            background.paste(image, mask=image.convert("RGBA").split()[-1])
            image = background
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise ServiceError("Bu fayl rasm emas yoki buzilgan. Boshqa rasm tanlang.", "avatar") from exc
    buffer = io.BytesIO()
    image.save(buffer, "JPEG", quality=85)
    old = user.avatar.name
    user.avatar.save("avatar.jpg", ContentFile(buffer.getvalue()), save=False)
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
