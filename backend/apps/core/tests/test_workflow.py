from django.test import SimpleTestCase

from apps.core.workflow import TransitionError, allowed_targets, check_transition

TABLE = {
    ("a", "b"): {"pm", "dev"},
    ("a", "c"): {"pm"},
    ("b", "a"): {"pm"},
}


class CheckTransitionTests(SimpleTestCase):
    def test_allowed_transition_passes(self):
        check_transition(TABLE, "a", "b", "dev")

    def test_unknown_transition_is_rejected(self):
        with self.assertRaisesMessage(TransitionError, "o'tish mumkin emas"):
            check_transition(TABLE, "b", "c", "pm")

    def test_role_without_permission_is_rejected(self):
        with self.assertRaisesMessage(TransitionError, "ruxsatingiz yo'q"):
            check_transition(TABLE, "a", "c", "dev")


class AllowedTargetsTests(SimpleTestCase):
    def test_returns_sorted_targets_for_role(self):
        self.assertEqual(allowed_targets(TABLE, "a", "pm"), ["b", "c"])

    def test_filters_by_role(self):
        self.assertEqual(allowed_targets(TABLE, "a", "dev"), ["b"])

    def test_no_targets_for_unknown_state(self):
        self.assertEqual(allowed_targets(TABLE, "z", "pm"), [])
