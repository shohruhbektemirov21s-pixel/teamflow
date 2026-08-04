"""Buyurtmalar: kim nimani ko'radi va qila oladi — BITTA joyda."""
from .models import Order


def visible_orders(user):
    """Boshqarma — faqat o'zi yuborganlar. PM/Boshliq — hammasi. Dasturchi — hech narsa."""
    qs = Order.objects.select_related("submitted_by", "approved_by")
    if user.is_manager:
        return qs
    if user.is_department:
        return qs.filter(submitted_by=user)
    return qs.none()


def can_view_order(user, order):
    return user.is_manager or (user.is_department and order.submitted_by_id == user.pk)
