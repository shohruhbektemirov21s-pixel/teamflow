"""Portfolio videolari: tur, hajm va fayl boshidagi belgi (magic bytes) tekshiruvi; qismlab berish (Range)."""
import io
import os
import re

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.files.base import ContentFile
from django.http import FileResponse, HttpResponse, StreamingHttpResponse
from django.utils.http import content_disposition_header
from PIL import Image, ImageOps, UnidentifiedImageError

from apps.core.serving import accel_enabled, protected_file

_RANGE = re.compile(r"^bytes=(\d*)-(\d*)$")
_CHUNK = 256 * 1024

VIDEO_TYPES = {"mp4": "video/mp4", "webm": "video/webm", "mov": "video/quicktime"}
# MP4/MOV (ISO BMFF) faylining 4–8 baytlari — birinchi "box" turi; WebM — EBML sarlavhasi.
_ISO_BOXES = {b"ftyp", b"moov", b"mdat", b"wide", b"free", b"skip"}
_EBML = b"\x1a\x45\xdf\xa3"


def cover_url(item):
    if not item.cover:
        return None
    version = item.updated_at.strftime("%Y%m%d%H%M%S%f") if item.updated_at else item.pk
    return f"/api/portfolio/covers/{item.pk}/?v={version}"


def normalized_cover(upload):
    """Muqova rasmi: tarkibini tekshiradi, EXIFni olib tashlaydi va xavfsiz JPEG qaytaradi."""
    return normalized_image(upload, max_mb=settings.PORTFOLIO_COVER_MAX_MB, name="cover.jpg")


def normalized_image(upload, *, max_mb, name):
    """Rasm tarkibini tekshiradi (kengaytmaga ishonilmaydi), EXIFni olib tashlaydi va xavfsiz JPEG qaytaradi."""
    if upload.size > max_mb * 1024 * 1024:
        raise ValidationError(f"Rasm hajmi {max_mb} MB dan oshmasligi kerak.")
    try:
        image = Image.open(upload)
        if image.format not in ("JPEG", "PNG", "WEBP"):
            raise ValidationError("Faqat JPG, PNG yoki WEBP rasm yuklang.")
        image = ImageOps.exif_transpose(image)
        image.thumbnail((settings.PORTFOLIO_COVER_MAX_PX, settings.PORTFOLIO_COVER_MAX_PX))
        if image.mode != "RGB":
            background = Image.new("RGB", image.size, "white")
            background.paste(image, mask=image.convert("RGBA").split()[-1])
            image = background
        buffer = io.BytesIO()
        image.save(buffer, "JPEG", quality=85)
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise ValidationError("Bu fayl rasm emas yoki buzilgan. Boshqa rasm tanlang.") from exc
    return ContentFile(buffer.getvalue(), name=name)


IMAGE_EXTENSIONS = {"png", "jpg", "jpeg", "webp"}
# Hujjat: kengaytma ruxsat ro'yxatida (docx, pdf) va fayl boshidagi belgi mos bo'lishi kerak.
DOCUMENT_TYPES = {
    "pdf": ("application/pdf", b"%PDF"),
    "docx": ("application/vnd.openxmlformats-officedocument.wordprocessingml.document", b"PK\x03\x04"),
}


def extension(name):
    return os.path.splitext(name)[1].lstrip(".").lower()


def validate_document(file):
    ext = extension(file.name)
    if ext not in DOCUMENT_TYPES:
        raise ValidationError("Faqat rasm, Word (.docx) yoki PDF fayl yuklang.")
    max_bytes = settings.UPLOAD_MAX_MB * 1024 * 1024
    if file.size > max_bytes:
        raise ValidationError(f"Fayl hajmi {settings.UPLOAD_MAX_MB} MB dan oshmasligi kerak.")
    position = file.tell() if hasattr(file, "tell") else 0
    file.seek(0)
    head = file.read(4)
    file.seek(position)
    if not head.startswith(DOCUMENT_TYPES[ext][1]):
        raise ValidationError("Fayl buzilgan yoki kengaytmasiga mos emas.")


def attachment_response(attachment):
    """Rasm — brauzerda ko'rsatiladi; hujjat — yuklab olinadi. Tarkib turi har doim biz belgilaymiz (nosniff)."""
    if attachment.kind == "image":
        return protected_file(attachment.file, content_type="image/jpeg", filename=attachment.original_name,
                              cache_control="private, max-age=86400")
    content_type = DOCUMENT_TYPES.get(extension(attachment.original_name), ("application/octet-stream",))[0]
    return protected_file(attachment.file, content_type=content_type, filename=attachment.original_name, as_attachment=True)


def video_content_type(name):
    return VIDEO_TYPES.get(os.path.splitext(name)[1].lstrip(".").lower(), "application/octet-stream")


def validate_video(file):
    ext = os.path.splitext(file.name)[1].lstrip(".").lower()
    if ext not in VIDEO_TYPES:
        raise ValidationError("Faqat video qabul qilinadi: MP4, WebM yoki MOV.")
    max_bytes = settings.PORTFOLIO_VIDEO_MAX_MB * 1024 * 1024
    if file.size > max_bytes:
        raise ValidationError(f"Video hajmi {settings.PORTFOLIO_VIDEO_MAX_MB} MB dan oshmasligi kerak.")
    position = file.tell() if hasattr(file, "tell") else 0
    file.seek(0)
    head = file.read(12)
    file.seek(position)
    is_webm = head[:4] == _EBML
    is_iso = head[4:8] in _ISO_BOXES
    if not ((ext == "webm" and is_webm) or (ext in ("mp4", "mov") and is_iso)):
        raise ValidationError("Fayl video emas yoki buzilgan. MP4, WebM yoki MOV yuklang.")


def _read(handle, length):
    try:
        while length > 0:
            chunk = handle.read(min(_CHUNK, length))
            if not chunk:
                break
            length -= len(chunk)
            yield chunk
    finally:
        handle.close()


def video_response(request, video):
    """Videoni brauzerda ko'rsatish: `Range` so'rovi bo'lsa 206 bilan faqat so'ralgan qism (oldinga o'tkazish ishlaydi).
    Production'da faylni (Range bilan) Nginx beradi — `apps.core.serving`."""
    content_type = video_content_type(video.original_name)
    if accel_enabled():
        # Video id o'zgarmaydi (yangi yuklash — yangi id), shuning uchun brauzer keshlashi xavfsiz.
        return protected_file(video.file, content_type=content_type, filename=video.original_name,
                              cache_control="private, max-age=86400")
    size = video.file.size
    match = _RANGE.match(request.META.get("HTTP_RANGE", "").strip())
    if match and (match.group(1) or match.group(2)):
        first, last = match.groups()
        if first:
            start, end = int(first), min(int(last) if last else size - 1, size - 1)
        else:
            start, end = max(size - int(last), 0), size - 1
        if start >= size or start > end:
            response = HttpResponse(status=416)
            response["Content-Range"] = f"bytes */{size}"
            return response
        handle = video.file.open("rb")
        handle.seek(start)
        response = StreamingHttpResponse(_read(handle, end - start + 1), status=206, content_type=content_type)
        response["Content-Range"] = f"bytes {start}-{end}/{size}"
        response["Content-Length"] = str(end - start + 1)
    else:
        response = FileResponse(video.file.open("rb"), content_type=content_type)
    response["Accept-Ranges"] = "bytes"
    response["Content-Disposition"] = content_disposition_header(False, video.original_name)
    response["X-Content-Type-Options"] = "nosniff"
    return response
