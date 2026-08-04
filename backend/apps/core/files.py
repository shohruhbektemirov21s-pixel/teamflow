"""Yuklanadigan fayllar uchun umumiy validatsiya va saqlash yo'li."""
import os
import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.utils.deconstruct import deconstructible


def validate_upload(file):
    """Kengaytma ro'yxati va hajm chegarasini tekshiradi."""
    ext = os.path.splitext(file.name)[1].lstrip(".").lower()
    if ext not in settings.UPLOAD_ALLOWED_EXTENSIONS:
        allowed = ", ".join(settings.UPLOAD_ALLOWED_EXTENSIONS)
        raise ValidationError(f"Bu turdagi fayl qabul qilinmaydi. Ruxsat etilgan: {allowed}.")
    max_bytes = settings.UPLOAD_MAX_MB * 1024 * 1024
    if file.size > max_bytes:
        raise ValidationError(f"Fayl hajmi {settings.UPLOAD_MAX_MB} MB dan oshmasligi kerak.")


@deconstructible
class UploadTo:
    """`upload_to` uchun: foydalanuvchi bergan nom o'rniga tasodifiy nom.

    Asl nom modelda alohida `original_name` maydonida saqlanadi.
    `deconstructible` — migratsiyalarda serializatsiya qilinishi uchun.
    """

    def __init__(self, folder):
        self.folder = folder

    def __call__(self, instance, filename):
        ext = os.path.splitext(filename)[1].lower()
        return f"{self.folder}/{uuid.uuid4().hex}{ext}"
