"""Ro'yxatlarni saralash — Vazifalar va Buyurtmalar uchun BITTA qoida.

`?sort=` qiymati faqat oq ro'yxatdagi kalitlardan biri bo'lishi mumkin; noma'lum qiymat e'tiborga olinmaydi
(ro'yxat o'zining standart tartibida qoladi).
"""
from django.db.models import Case, F, IntegerField, Value, When

from .choices import Priority

PRIORITY_ORDER = [Priority.LOW, Priority.MEDIUM, Priority.HIGH, Priority.URGENT]


def priority_rank(field="priority"):
    """Muhimlik raqami: past=0 … shoshilinch=3 (matn bo'yicha saralash alifbo tartibini beradi, bu esa noto'g'ri)."""
    return Case(
        *[When(**{field: p}, then=Value(rank)) for rank, p in enumerate(PRIORITY_ORDER)],
        default=Value(1), output_field=IntegerField(),
    )


def sort_expressions(sort, due_field, created_field="created_at"):
    """`sort` kaliti → order_by ifodalari ro'yxati yoki None (kalit noma'lum).

    Kalitlar: due / -due (muddat), priority / -priority (muhimlik; `-priority` — shoshilinchlari birinchi),
    created / -created (yaratilgan vaqt; `-created` — yangilari birinchi). Muddati yo'qlar doim oxirida.
    """
    due = F(due_field)
    created = F(created_field)
    table = {
        "due": [due.asc(nulls_last=True)],
        "-due": [due.desc(nulls_last=True)],
        "priority": [priority_rank().asc(), due.asc(nulls_last=True)],
        "-priority": [priority_rank().desc(), due.asc(nulls_last=True)],
        "created": [created.asc()],
        "-created": [created.desc()],
    }
    expressions = table.get(sort or "")
    return None if expressions is None else [*expressions, "-pk"]
