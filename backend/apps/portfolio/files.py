"""Portfolio videolari: tur, hajm va fayl boshidagi belgi (magic bytes) tekshiruvi; qismlab berish (Range)."""
import os
import re

from django.conf import settings
from django.core.exceptions import ValidationError
from django.http import FileResponse, HttpResponse, StreamingHttpResponse
from django.utils.http import content_disposition_header

_RANGE = re.compile(r"^bytes=(\d*)-(\d*)$")
_CHUNK = 256 * 1024

VIDEO_TYPES = {"mp4": "video/mp4", "webm": "video/webm", "mov": "video/quicktime"}
# MP4/MOV (ISO BMFF) faylining 4–8 baytlari — birinchi "box" turi; WebM — EBML sarlavhasi.
_ISO_BOXES = {b"ftyp", b"moov", b"mdat", b"wide", b"free", b"skip"}
_EBML = b"\x1a\x45\xdf\xa3"


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
    """Videoni brauzerda ko'rsatish: `Range` so'rovi bo'lsa 206 bilan faqat so'ralgan qism (oldinga o'tkazish ishlaydi)."""
    content_type = video_content_type(video.original_name)
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
