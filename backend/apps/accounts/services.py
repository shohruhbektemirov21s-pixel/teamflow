"""Akkaunt amallari: profil rasmi."""
import io

from django.core.files.base import ContentFile
from PIL import Image, ImageOps, UnidentifiedImageError

from apps.core.api_utils import ServiceError

AVATAR_MAX_MB = 5
AVATAR_SIZE = 1024  # px, eng uzun tomoni — katta ko'rinishda (rasm oynasi) ham tiniq


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
