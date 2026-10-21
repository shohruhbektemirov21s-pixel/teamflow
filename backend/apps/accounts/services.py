"""Akkaunt amallari: profil rasmi, xizmat safari, mas'ul loyihalar va ularning yangiliklari."""
import io

from django.core.files.base import ContentFile
from django.db import transaction
from django.utils import timezone
from PIL import Image, ImageOps, UnidentifiedImageError

from apps.core.api_utils import ServiceError
from apps.core.services import log

from .models import ResponsibleProject, ResponsibleProjectNews, Role, User

AVATAR_MAX_MB = 5
AVATAR_SIZE = 1024  # px, eng uzun tomoni — katta ko'rinishda (rasm oynasi) ham tiniq


# ─── Mas'ul loyihalar ────────────────────────────────────────────────────────
# Ruxsat qoidasi shu yerda, bitta joyda. Xodim oynasi bilan bir xil: Boshliq — faol PM va dasturchilar,
# PM — faol dasturchilar. Mas'ul xodimning o'zi loyihalarini ko'radi va yangilik yozadi; **dasturchi** (2026-10-20)
# o'z loyihalarini qo'shadi, tahrirlaydi va o'chiradi ham (PM'niki — faqat Boshliq). Boshqa hech kim
# (boshqarma, oddiy foydalanuvchi, boshqa dasturchi) ko'rmaydi.

RESPONSIBLE_ROLES = (Role.PM, Role.DEVELOPER)
PROJECT_NAME_MAX = 255
PROJECT_DESCRIPTION_MAX = 1000
NEWS_MAX = 2000


def responsible_employees():
    return User.objects.filter(is_active=True, role__in=RESPONSIBLE_ROLES)


def managed_employees(actor):
    """Mas'ul loyihalarini `actor` qo'sha/tahrirlay oladigan xodimlar."""
    if not actor.is_manager:
        return responsible_employees().none()
    qs = responsible_employees()
    return qs if actor.is_boss else qs.filter(role=Role.DEVELOPER)


def can_manage_responsible(actor, employee):
    if actor.is_developer and actor.pk == employee.pk:
        return employee.is_active
    return managed_employees(actor).filter(pk=employee.pk).exists()


def can_view_responsible(actor, employee):
    """Ko'rish va yangilik yozish huquqi: mas'ul xodimning o'zi yoki uni boshqaradigan Boshliq/PM."""
    if actor.pk == employee.pk:
        return employee.is_active and employee.role in RESPONSIBLE_ROLES
    return can_manage_responsible(actor, employee)


def _clean_project(name, description):
    name, description = (name or "").strip(), (description or "").strip()
    if not name:
        raise ServiceError("Loyiha nomini yozing.", "name")
    if len(name) > PROJECT_NAME_MAX:
        raise ServiceError(f"Loyiha nomi {PROJECT_NAME_MAX} belgidan oshmasin.", "name")
    if len(description) > PROJECT_DESCRIPTION_MAX:
        raise ServiceError(f"Izoh {PROJECT_DESCRIPTION_MAX} belgidan oshmasin.", "description")
    return name, description


def _ensure_manage(actor, employee):
    if not can_manage_responsible(actor, employee):
        raise ServiceError("Mas'ul loyihani Boshliq, PM yoki dasturchining o'zi kiritadi.")


@transaction.atomic
def create_responsible_project(actor, employee, *, name, description=""):
    _ensure_manage(actor, employee)
    name, description = _clean_project(name, description)
    project = ResponsibleProject.objects.create(employee=employee, name=name, description=description, created_by=actor)
    log(actor, "responsible_project_added", f"{actor.full_name} {employee.full_name}ga mas'ul loyiha qo'shdi: {name}", employee)
    return project


@transaction.atomic
def update_responsible_project(actor, project, *, name, description=""):
    _ensure_manage(actor, project.employee)
    name, description = _clean_project(name, description)
    if (project.name, project.description) != (name, description):
        project.name, project.description = name, description
        project.save(update_fields=["name", "description", "updated_at"])
        log(actor, "responsible_project_updated", f"{actor.full_name} mas'ul loyihani tahrirladi: {name}", project.employee)
    return project


@transaction.atomic
def delete_responsible_project(actor, project):
    _ensure_manage(actor, project.employee)
    log(actor, "responsible_project_deleted", f"{actor.full_name} mas'ul loyihani o'chirdi: {project.name}", project.employee)
    project.delete()


@transaction.atomic
def add_responsible_news(actor, project, text):
    if not can_view_responsible(actor, project.employee):
        raise ServiceError("Bu loyihaga yangilik yozishga ruxsatingiz yo'q.")
    text = (text or "").strip()
    if not text:
        raise ServiceError("Yangilik matnini yozing.", "text")
    if len(text) > NEWS_MAX:
        raise ServiceError(f"Yangilik {NEWS_MAX} belgidan oshmasin.", "text")
    news = ResponsibleProjectNews.objects.create(project=project, author=actor, text=text)
    project.save(update_fields=["updated_at"])
    log(actor, "responsible_news_added", f"{actor.full_name} \"{project.name}\" loyihasi bo'yicha yangilik yozdi", project.employee)
    return news


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
