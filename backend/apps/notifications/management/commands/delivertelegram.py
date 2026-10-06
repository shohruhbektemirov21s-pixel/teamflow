import time

from django.core.management.base import BaseCommand, CommandError
from django.db import close_old_connections

from apps.notifications import telegram
from apps.notifications.delivery import deliver_one


class Command(BaseCommand):
    help = "Deliver committed Telegram outbox messages with bounded retries."

    def add_arguments(self, parser):
        parser.add_argument("--once", action="store_true")

    def handle(self, *args, **options):
        if not telegram.enabled():
            raise CommandError("TELEGRAM_BOT_TOKEN is not configured.")
        try:
            while True:
                close_old_connections()
                processed = deliver_one()
                if options["once"]:
                    break
                time.sleep(0.04 if processed else 1)
        except KeyboardInterrupt:
            pass
