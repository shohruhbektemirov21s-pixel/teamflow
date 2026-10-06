import datetime
import unittest

from django.db import connection
from django.test import SimpleTestCase, TestCase
from django.utils import timezone

from apps.accounts.models import Role
from apps.core import partitions
from apps.notifications.models import Notification
from apps.panel.tests.factories import make_user


class MonthMathTests(SimpleTestCase):
    def test_add_months_crosses_year(self):
        self.assertEqual(partitions.add_months(datetime.date(2026, 11, 1), 3), datetime.date(2027, 2, 1))
        self.assertEqual(partitions.add_months(datetime.date(2026, 1, 1), -1), datetime.date(2025, 12, 1))

    def test_partition_name(self):
        self.assertEqual(
            partitions.partition_name("chat_chatmessage", datetime.date(2026, 3, 1)), "chat_chatmessage_p2026_03"
        )

    def test_sqlite_is_untouched(self):
        if connection.vendor == "sqlite":
            self.assertEqual(partitions.ensure_partitions(), [])


@unittest.skipUnless(connection.vendor == "postgresql", "partitsiyalar faqat PostgreSQL'da")
class PostgresPartitionTests(TestCase):
    def _relkind(self, name):
        with connection.cursor() as cursor:
            cursor.execute("SELECT relkind FROM pg_class WHERE oid = to_regclass(%s)", [name])
            row = cursor.fetchone()
        return row[0] if row else None

    def test_tables_are_partitioned_with_months_ahead(self):
        month = partitions.month_start(timezone.now())
        for table in partitions.partitioned_tables():
            with self.subTest(table=table):
                self.assertEqual(self._relkind(table), "p")
                self.assertEqual(self._relkind(f"{table}_default"), "r")
                for offset in range(partitions.MONTHS_AHEAD + 1):
                    name = partitions.partition_name(table, partitions.add_months(month, offset))
                    self.assertEqual(self._relkind(name), "r")

    def test_rows_in_default_move_to_new_month_partition(self):
        table = Notification._meta.db_table
        far = partitions.add_months(partitions.month_start(timezone.now()), 12)
        user = make_user(Role.DEVELOPER)
        notice = Notification.objects.create(recipient=user, kind=Notification.Kind.COMMENT, message="x")
        stamp = datetime.datetime(far.year, far.month, 15, tzinfo=datetime.timezone.utc)
        Notification.objects.filter(pk=notice.pk).update(created_at=stamp)  # oldindan partitsiyasi yo'q oy → DEFAULT
        with connection.cursor() as cursor:
            cursor.execute(f'SELECT count(*) FROM "{table}_default"')
            self.assertEqual(cursor.fetchone()[0], 1)
            self.assertTrue(partitions.ensure_month(cursor, table, far))
            cursor.execute(f'SELECT count(*) FROM "{table}_default"')
            self.assertEqual(cursor.fetchone()[0], 0)
            cursor.execute(f'SELECT count(*) FROM "{partitions.partition_name(table, far)}"')
            self.assertEqual(cursor.fetchone()[0], 1)
        self.assertEqual(Notification.objects.get(pk=notice.pk).created_at, stamp)  # Django uchun hech narsa o'zgarmadi

    def test_old_rows_in_default_get_their_own_month(self):
        # SQLite'dan ko'chirilgan tarix: partitsiyasi yo'q o'tgan oy → DEFAULT → ensure_partitions ajratadi
        table = Notification._meta.db_table
        past = partitions.add_months(partitions.month_start(timezone.now()), -14)
        user = make_user(Role.DEVELOPER)
        notice = Notification.objects.create(recipient=user, kind=Notification.Kind.COMMENT, message="x")
        Notification.objects.filter(pk=notice.pk).update(
            created_at=datetime.datetime(past.year, past.month, 3, tzinfo=datetime.timezone.utc)
        )
        self.assertIn(partitions.partition_name(table, past), partitions.ensure_partitions())
        with connection.cursor() as cursor:
            cursor.execute(f'SELECT count(*) FROM "{table}_default"')
            self.assertEqual(cursor.fetchone()[0], 0)
