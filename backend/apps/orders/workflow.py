"""Buyurtma holat mashinasi — o'tishlar BITTA jadvalda.

submitted ──▶ approved ──▶ project_created
    └──▶ rejected ──(yangi TZ versiyasi)──▶ submitted
"""
from apps.accounts.models import Role
from apps.core.workflow import allowed_targets, check_transition

from .models import Order

S = Order.Status
MANAGERS = {Role.PM, Role.BOSS}

TRANSITIONS = {
    (S.SUBMITTED, S.APPROVED): MANAGERS,
    (S.SUBMITTED, S.REJECTED): MANAGERS,
    (S.REJECTED, S.SUBMITTED): {Role.DEPARTMENT},  # yangi TZ versiyasi yuborilganda
    (S.APPROVED, S.PROJECT_CREATED): MANAGERS,
}


def check_order_transition(current, target, role):
    check_transition(TRANSITIONS, current, target, role)


def order_targets(current, role):
    return allowed_targets(TRANSITIONS, current, role)
