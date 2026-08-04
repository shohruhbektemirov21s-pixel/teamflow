"""Buyurtma biznes amallari. Har biri tranzaksiyada; holat o'tishi faqat `workflow` orqali."""
from django.db import transaction
from django.utils import timezone

from apps.core.api_utils import ServiceError
from apps.core.services import log
from apps.notifications.models import Notification
from apps.notifications.services import managers, notify

from .models import Order, OrderVersion
from .workflow import check_order_transition

K = Notification.Kind


def _check_dates(start_date, end_date):
    if not start_date or not end_date:
        raise ServiceError("Boshlanish va tugash sanasini kiriting.")
    if end_date < start_date:
        raise ServiceError("Tugash sanasi boshlanish sanasidan oldin bo'lishi mumkin emas.", "end_date")


@transaction.atomic
def create_order(user, *, title, description, priority, requested_due_date, file):
    if not user.is_department:
        raise ServiceError("Buyurtmani faqat boshqarma yuboradi.")
    order = Order.objects.create(
        title=title,
        description=description,
        priority=priority,
        requested_due_date=requested_due_date,
        submitted_by=user,
    )
    OrderVersion.objects.create(order=order, number=1, file=file, original_name=file.name, uploaded_by=user)
    notify(managers(), K.ORDER_SUBMITTED, f"Yangi buyurtma: {order.title} ({user.department_name})", order)
    log(user, "order_submitted", f"{user.full_name} buyurtma yubordi: {order.title}", order)
    return order


@transaction.atomic
def add_version(order, user, *, file, note):
    """Rad etilgan buyurtmaga yangi TZ. Ko'rib chiqilayotgan paytda yuborib bo'lmaydi."""
    order = Order.objects.select_for_update().get(pk=order.pk)
    if order.submitted_by_id != user.pk:
        raise ServiceError("Faqat buyurtmani yuborgan boshqarma yangi versiya yubora oladi.")
    if order.status != Order.Status.REJECTED:
        raise ServiceError("Yangi versiyani faqat buyurtma rad etilgandan keyin yuborish mumkin.")
    if not note.strip():
        raise ServiceError("Nimalar tuzatilganini yozing.", "note")
    check_order_transition(order.status, Order.Status.SUBMITTED, user.role)
    number = order.versions.count() + 1
    OrderVersion.objects.create(
        order=order, number=number, file=file, original_name=file.name, note=note.strip(), uploaded_by=user
    )
    order.status = Order.Status.SUBMITTED
    order.save(update_fields=["status", "updated_at"])
    notify(managers(), K.ORDER_RESUBMITTED, f"Yangi TZ (v{number}): {order.title}", order)
    log(user, "order_resubmitted", f"{user.full_name} TZ v{number} yubordi: {order.title}", order)
    return order


@transaction.atomic
def approve_order(order, user, *, start_date, end_date, note="", priority=None):
    order = Order.objects.select_for_update().get(pk=order.pk)
    check_order_transition(order.status, Order.Status.APPROVED, user.role)
    _check_dates(start_date, end_date)
    now = timezone.now()
    version = order.latest_version
    version.decision = OrderVersion.Decision.APPROVED
    version.decided_by = user
    version.decided_at = now
    version.save()
    order.status = Order.Status.APPROVED
    order.approved_by = user  # tasdiqlagan PM — mas'ul PM
    order.start_date = start_date
    order.end_date = end_date
    order.pm_note = note.strip()
    order.decided_at = now
    if priority:
        order.priority = priority
    order.save()
    notify([order.submitted_by], K.ORDER_APPROVED, f"Buyurtmangiz tasdiqlandi: {order.title}", order)
    log(user, "order_approved", f"{user.full_name} buyurtmani tasdiqladi: {order.title}", order)
    return order


@transaction.atomic
def reject_order(order, user, *, reason):
    order = Order.objects.select_for_update().get(pk=order.pk)
    check_order_transition(order.status, Order.Status.REJECTED, user.role)
    if not reason.strip():
        raise ServiceError("Rad etish sababini yozing — boshqarma nimani tuzatishni bilishi kerak.", "reason")
    now = timezone.now()
    version = order.latest_version
    version.decision = OrderVersion.Decision.REJECTED
    version.reject_reason = reason.strip()
    version.decided_by = user
    version.decided_at = now
    version.save()
    order.status = Order.Status.REJECTED
    order.decided_at = now
    order.save(update_fields=["status", "decided_at", "updated_at"])
    notify([order.submitted_by], K.ORDER_REJECTED, f"Buyurtmangiz rad etildi: {order.title}", order)
    log(user, "order_rejected", f"{user.full_name} buyurtmani rad etdi: {order.title}", order)
    return order


@transaction.atomic
def update_order_dates(order, user, *, start_date, end_date):
    """Tasdiqlangandan keyin PM faqat sanalarni o'zgartira oladi. Loyiha bo'lsa, uning sanalari ham."""
    if not user.is_manager:
        raise ServiceError("Sanani faqat loyiha menejeri yoki boshliq o'zgartiradi.")
    if order.status not in (Order.Status.APPROVED, Order.Status.PROJECT_CREATED):
        raise ServiceError("Sanani faqat tasdiqlangan buyurtmada o'zgartirish mumkin.")
    _check_dates(start_date, end_date)
    order.start_date = start_date
    order.end_date = end_date
    order.save(update_fields=["start_date", "end_date", "updated_at"])
    project = getattr(order, "project", None)  # teskari bog'lanish — projects import qilinmaydi
    if project is not None:
        project.start_date = start_date
        project.end_date = end_date
        project.save(update_fields=["start_date", "end_date", "updated_at"])
    log(user, "order_dates", f"{user.full_name} buyurtma sanalarini o'zgartirdi: {order.title}", order)
    return order
