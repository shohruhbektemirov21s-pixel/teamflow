"""Ruxsati tekshirilgan media faylni berish — bitta joyda.

Production'da (`PROTECTED_MEDIA_ACCEL_PREFIX` berilgan) Django faqat ruxsatni tekshiradi va
`X-Accel-Redirect` qaytaradi: faylni Nginx o'zi (sendfile, Range, sekin mijoz) beradi, Gunicorn
oqimi darrov bo'shaydi. Mahalliy ishga tushirishda (prefiks bo'sh) fayl Django orqali beriladi.
**Nima uchun:** Gunicorn oqimlari soni cheklangan (12×2); avatar, muqova va 100 MB video ularni
band qilsa, 10 000 faol foydalanuvchida API so'rovlari navbatda qoladi.
"""
from urllib.parse import quote

from django.conf import settings
from django.http import FileResponse, HttpResponse
from django.utils.http import content_disposition_header


def accel_enabled():
    return bool(settings.PROTECTED_MEDIA_ACCEL_PREFIX)


def protected_file(field_file, *, content_type, filename=None, as_attachment=False, cache_control="no-store"):
    """`FieldFile` uchun javob. Fayl diskda bo'lmasa `FileNotFoundError` (chaqiruvchi 404 qiladi)."""
    if accel_enabled():
        if not field_file.storage.exists(field_file.name):
            raise FileNotFoundError(field_file.name)
        response = HttpResponse(content_type=content_type)
        response["X-Accel-Redirect"] = settings.PROTECTED_MEDIA_ACCEL_PREFIX + quote(field_file.name)
    else:
        response = FileResponse(field_file.open("rb"), content_type=content_type)
    if filename:
        response["Content-Disposition"] = content_disposition_header(as_attachment, filename)
    elif "Content-Disposition" in response:
        del response["Content-Disposition"]  # ichki (tasodifiy) fayl nomi tashqariga chiqmasin
    response["X-Content-Type-Options"] = "nosniff"
    response["Cache-Control"] = cache_control
    return response
