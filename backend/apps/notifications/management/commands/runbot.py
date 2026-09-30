"""Telegram bot: foydalanuvchi botga /start yozsa, uning chat_id si akkauntiga bog'lanadi.

Ishga tushirish: `TELEGRAM_BOT_TOKEN` muhit o'zgaruvchisi bilan `python manage.py runbot`.
Qo'shimcha kutubxona kerak emas — Bot API'ga `requests` bilan uzun so'rov (long polling).
"""
import time

import requests
from django.core.management.base import BaseCommand, CommandError

from apps.notifications import telegram


class Command(BaseCommand):
    help = "Telegram botni ishga tushiradi (/start — bildirishnomalarni ulash)"

    def handle(self, *args, **options):
        if not telegram.enabled():
            raise CommandError("TELEGRAM_BOT_TOKEN muhit o'zgaruvchisi o'rnatilmagan.")
        self.stdout.write(self.style.SUCCESS("Telegram bot ishga tushdi. To'xtatish: Ctrl+C"))
        offset = None
        try:
            while True:
                try:
                    response = requests.get(
                        telegram.api_url("getUpdates"),
                        params={"timeout": telegram.POLL_TIMEOUT, "offset": offset},
                        timeout=telegram.POLL_TIMEOUT + 10,
                    )
                    if response.status_code == 409:
                        # Shu token bilan boshqa joyda ham bot ishlayapti — Telegram yangilanishlarni bittasiga beradi
                        self.stderr.write("409: shu token bilan boshqa joyda ham bot ishlayapti. O'shasini to'xtating yoki BotFather'da tokenni yangilang.")
                        time.sleep(5)
                        continue
                    response.raise_for_status()
                    updates = response.json().get("result", [])
                except (requests.RequestException, ValueError) as exc:
                    # Xato matnida URL (demak token) bo'lishi mumkin — logga faqat turi yoziladi
                    reason = getattr(getattr(exc, "response", None), "status_code", None) or type(exc).__name__
                    self.stderr.write(f"Telegram bilan aloqa yo'q ({reason}), 5 soniyadan keyin qayta urinaman.")
                    time.sleep(5)
                    continue
                for update in updates:
                    offset = update["update_id"] + 1
                    reply = telegram.handle_update(update)
                    if reply:
                        telegram.send_message(*reply)
        except KeyboardInterrupt:
            self.stdout.write("Bot to'xtatildi.")
