from django.test import SimpleTestCase

from apps.accounts.models import Role
from apps.core.workflow import TransitionError
from apps.tasks.models import Task
from apps.tasks.workflow import check_task_transition, task_targets

S = Task.Status


class TaskWorkflowTests(SimpleTestCase):
    def test_developer_can_start_and_submit(self):
        check_task_transition(S.CONTROL, S.IN_PROGRESS, Role.DEVELOPER)
        check_task_transition(S.IN_PROGRESS, S.IN_REVIEW, Role.DEVELOPER)

    def test_developer_cannot_mark_done(self):
        with self.assertRaises(TransitionError):
            check_task_transition(S.IN_REVIEW, S.DONE, Role.DEVELOPER)
        with self.assertRaises(TransitionError):
            check_task_transition(S.IN_PROGRESS, S.DONE, Role.DEVELOPER)

    def test_manager_reviews(self):
        for role in (Role.PM, Role.BOSS):
            check_task_transition(S.IN_REVIEW, S.DONE, role)
            check_task_transition(S.IN_REVIEW, S.IN_PROGRESS, role)
            with self.assertRaises(TransitionError):
                check_task_transition(S.IN_PROGRESS, S.IN_REVIEW, role)

    def test_department_has_no_task_transitions(self):
        for source in S.values:
            self.assertEqual(task_targets(source, Role.DEPARTMENT), [])

    def test_skipping_states_forbidden(self):
        with self.assertRaises(TransitionError):
            check_task_transition(S.CONTROL, S.IN_REVIEW, Role.PM)

    def test_done_is_final(self):
        for role in Role.values:
            self.assertEqual(task_targets(S.DONE, role), [])
