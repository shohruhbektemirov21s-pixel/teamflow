"""Yuklangan rasmni xavfsiz qayta ishlash: avatar va portfolio muqovasi uchun bitta qoida."""
import io

from django.core.files.base import ContentFile
from PIL import Image, ImageOps, UnidentifiedImageError

from apps.core.api_utils import ServiceError


def to_jpeg(upload, field, max_mb, max_px):
    """Rasm Pillow bilan ochiladi (kengaytmaga ishonilmaydi), `max_px` gacha kichraytiriladi va JPEG qilib qayta
    saqlanadi — EXIF (joylashuv va h.k.) o'chadi, rasm bo'lmagan fayl o'tmaydi. `ContentFile` qaytaradi."""
    if upload.size > max_mb * 1024 * 1024:
        raise ServiceError(f"Rasm hajmi {max_mb} MB dan oshmasligi kerak.", field)
    try:
        image = Image.open(upload)
        if image.format not in ("JPEG", "PNG", "WEBP"):
            raise ServiceError("Faqat JPG, PNG yoki WEBP rasm yuklang.", field)
        image = ImageOps.exif_transpose(image)
        image.thumbnail((max_px, max_px))
        if image.mode != "RGB":
            background = Image.new("RGB", image.size, "white")
            background.paste(image, mask=image.convert("RGBA").split()[-1])
            image = background
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise ServiceError("Bu fayl rasm emas yoki buzilgan. Boshqa rasm tanlang.", field) from exc
    buffer = io.BytesIO()
    image.save(buffer, "JPEG", quality=85)
    return ContentFile(buffer.getvalue())
