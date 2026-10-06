"""Oylik partitsiyalarni oldindan yaratadi (joriy oy + keyingi 3 oy). Kuniga bir marta ishga tushiriladi —
Docker'da `scheduler` servisi; har deploy'da ham (`deploy/entrypoint.sh`). Takror ishga tushirish xavfsiz.

SQLite'da (dev) hech narsa qilmaydi.
"""
from django.core.management.base import BaseCommand
from django.db import connection

from apps.core.partitions import ensure_partitions


class Command(BaseCommand):
    help = "Bildirishnoma, chat va tarix jadvallari uchun oylik partitsiyalarni oldindan yaratadi"

    def handle(self, *args, **options):
        if connection.vendor != "postgresql":
            self.stdout.write("Partitsiyalar faqat PostgreSQL'da — o'tkazib yuborildi.")
            return
        names = ", ".join(ensure_partitions()) or "yo'q"
        self.stdout.write(self.style.SUCCESS(f"Yangi partitsiyalar: {names}"))
