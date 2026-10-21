"""Portfolio texnologiya nomlarini bitta kanonik shaklga keltirish."""

MAX_TECHNOLOGIES = 10
MAX_TECHNOLOGY_LENGTH = 50


def normalize_technologies(value):
    """Bo'shliq va takrorlarni olib tashlaydi; tartib va birinchi yozilish shaklini saqlaydi."""
    if not isinstance(value, list):
        raise ValueError("Texnologiyalar ro'yxat shaklida bo'lishi kerak.")
    normalized = []
    seen = set()
    for raw in value:
        if not isinstance(raw, str):
            raise ValueError("Har bir texnologiya matn bo'lishi kerak.")
        name = " ".join(raw.split())
        if not name:
            raise ValueError("Texnologiya nomi bo'sh bo'lishi mumkin emas.")
        if len(name) > MAX_TECHNOLOGY_LENGTH:
            raise ValueError(f"Texnologiya nomi {MAX_TECHNOLOGY_LENGTH} belgidan oshmasligi kerak.")
        key = name.casefold()
        if key not in seen:
            seen.add(key)
            normalized.append(name)
    if len(normalized) > MAX_TECHNOLOGIES:
        raise ValueError(f"Ko'pi bilan {MAX_TECHNOLOGIES} ta texnologiya kiriting.")
    return normalized
