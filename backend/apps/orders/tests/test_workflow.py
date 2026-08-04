from django.test import SimpleTestCase

from apps.accounts.models import Role
from apps.core.workflow import TransitionError
from apps.orders.models import Order
from apps.orders.workflow import check_order_transition, order_targets

S = Order.Status


class OrderWorkflowTests(SimpleTestCase):
    def test_managers_decide(self):
        for role in (Role.PM, Role.BOSS):
            check_order_transition(S.SUBMITTED, S.APPROVED, role)
            check_order_transition(S.SUBMITTED, S.REJECTED, role)
            check_order_transition(S.APPROVED, S.PROJECT_CREATED, role)

    def test_department_cannot_decide(self):
        with self.assertRaises(TransitionError):
            check_order_transition(S.SUBMITTED, S.APPROVED, Role.DEPARTMENT)

    def test_resubmit_only_after_reject_by_department(self):
        check_order_transition(S.REJECTED, S.SUBMITTED, Role.DEPARTMENT)
        with self.assertRaises(TransitionError):
            check_order_transition(S.REJECTED, S.SUBMITTED, Role.PM)
        # Ko'rib chiqilayotgan buyurtmaga yangi versiya yuborib bo'lmaydi.
        self.assertNotIn(S.SUBMITTED, order_targets(S.SUBMITTED, Role.DEPARTMENT))

    def test_developer_has_no_order_transitions(self):
        for source in S.values:
            self.assertEqual(order_targets(source, Role.DEVELOPER), [])
