from datetime import date, datetime
from unittest import mock
from zoneinfo import ZoneInfo

from django.test import SimpleTestCase, override_settings
from django.utils import timezone

from apps.core.periods import PERIOD_KEYS, period_cards, period_starts

TZ = ZoneInfo("Asia/Tashkent")


@override_settings(TIME_ZONE="Asia/Tashkent")
class PeriodStartsTests(SimpleTestCase):
    def test_wednesday_gives_year_month_and_monday_midnight(self):
        now = datetime(2026, 10, 7, 15, 30, tzinfo=TZ)
        starts = period_starts(now)
        self.assertEqual(starts["year"], datetime(2026, 1, 1, tzinfo=TZ))
        self.assertEqual(starts["month"], datetime(2026, 10, 1, tzinfo=TZ))
        self.assertEqual(starts["week"], datetime(2026, 10, 5, tzinfo=TZ))

    def test_monday_week_starts_same_day(self):
        now = datetime(2026, 10, 5, 0, 1, tzinfo=TZ)
        self.assertEqual(period_starts(now)["week"], datetime(2026, 10, 5, tzinfo=TZ))

    def test_local_date_is_used_not_utc(self):
        # 2026-01-01 00:30 Toshkent = 2025-12-31 19:30 UTC — yil baribir 2026 boshlanishi.
        now = datetime(2025, 12, 31, 19, 30, tzinfo=ZoneInfo("UTC"))
        self.assertEqual(period_starts(now)["year"], datetime(2026, 1, 1, tzinfo=TZ))


@override_settings(TIME_ZONE="Asia/Tashkent")
class PeriodCardsTests(SimpleTestCase):
    def test_cards_in_order_with_counts_per_start(self):
        fixed = datetime(2026, 10, 7, 12, 0, tzinfo=TZ)
        with mock.patch.object(timezone, "now", return_value=fixed):
            cards = period_cards(lambda since: {"n": since.day})
        self.assertEqual([c["key"] for c in cards], list(PERIOD_KEYS))
        self.assertEqual([c["since"] for c in cards], [date(2026, 1, 1), date(2026, 10, 1), date(2026, 10, 5)])
        self.assertEqual([c["counts"]["n"] for c in cards], [1, 1, 5])
