"""Yuklangan rasmlarni tiniq saqlash qoidasi — BITTA joyda (profil rasmi, portfolio muqovasi).

Nima uchun shunday: xiralik asosan uch joydan chiqadi — past JPEG sifati, rang kichraytirilishi (4:2:0: rangli chekkalar
yumshaydi) va kichik o'lcham. Shuning uchun: LANCZOS bilan kichraytirish (faqat kattasini, kichik rasm kattalashtirilmaydi),
sifat 92, `subsampling=0`. Telefon rasmlari (Display P3) sRGB'ga o'tkaziladi, aks holda EXIF/profil o'chgach ranglari so'nadi.
EXIF o'chadi (joylashuv va h.k.), yo'nalishi (`exif_transpose`) esa qo'llanadi.
"""
import io

from PIL import Image, ImageCms, ImageOps

JPEG_QUALITY = 92


def _to_srgb(image, icc_profile):
    """Rasm o'z rang profilidan sRGB'ga o'tkaziladi; profil buzuq bo'lsa rasm o'zgarmaydi."""
    if not icc_profile:
        return image
    try:
        source = ImageCms.ImageCmsProfile(io.BytesIO(icc_profile))
        return ImageCms.profileToProfile(image, source, ImageCms.createProfile("sRGB"), outputMode="RGB")
    except (ImageCms.PyCMSError, OSError, ValueError):
        return image


def to_sharp_jpeg(image, max_px):
    """Ochilgan `PIL.Image` ni tiniq JPEG baytlariga aylantiradi (eng uzun tomoni `max_px` dan oshmaydi)."""
    icc_profile = image.info.get("icc_profile")
    image = ImageOps.exif_transpose(image)
    image.thumbnail((max_px, max_px), Image.Resampling.LANCZOS)
    if image.mode in ("RGBA", "LA", "P"):
        rgba = image.convert("RGBA")
        flat = Image.new("RGB", rgba.size, "white")
        flat.paste(rgba, mask=rgba.split()[-1])
        image = flat
    elif image.mode != "RGB":
        image = image.convert("RGB")
    else:
        image = _to_srgb(image, icc_profile)
    buffer = io.BytesIO()
    image.save(buffer, "JPEG", quality=JPEG_QUALITY, subsampling=0, optimize=True, progressive=True)
    return buffer.getvalue()
