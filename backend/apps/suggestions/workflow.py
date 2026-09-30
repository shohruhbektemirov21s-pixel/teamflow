"""Taklif holat mashinasi — o'tishlar BITTA jadvalda.

pending ──(Boshliq)──▶ accepted
    └────(Boshliq)──▶ rejected
"""
from apps.accounts.models import Role
from apps.core.workflow import allowed_targets, check_transition

from .models import Suggestion

S = Suggestion.Status

TRANSITIONS = {
    (S.PENDING, S.ACCEPTED): {Role.BOSS},
    (S.PENDING, S.REJECTED): {Role.BOSS},
}


def check_suggestion_transition(current, target, role):
    check_transition(TRANSITIONS, current, target, role)


def suggestion_targets(current, role):
    return allowed_targets(TRANSITIONS, current, role)
