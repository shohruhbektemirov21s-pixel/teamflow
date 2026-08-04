"""Holat mashinalari uchun umumiy yordamchi.

Har bir app o'z o'tishlar jadvalini `workflow.py` da e'lon qiladi:
    {(joriy_holat, yangi_holat): {ruxsat_etilgan_rollar}}
Tekshiruv faqat shu yerdagi `check_transition` orqali bajariladi (boshqa joyda takrorlanmaydi).
"""


class TransitionError(Exception):
    """Holat o'tishi taqiqlangan yoki rolga ruxsat yo'q."""


def check_transition(table, current, target, role):
    allowed_roles = table.get((current, target))
    if allowed_roles is None:
        raise TransitionError(f"'{current}' holatidan '{target}' holatiga o'tish mumkin emas.")
    if role not in allowed_roles:
        raise TransitionError("Bu o'tishni bajarish uchun ruxsatingiz yo'q.")


def allowed_targets(table, current, role):
    """UI uchun: shu rol joriy holatdan qaysi holatlarga o'tkaza oladi."""
    return sorted(target for (source, target), roles in table.items() if source == current and role in roles)
