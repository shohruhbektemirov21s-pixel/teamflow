# Chat xabarlari oylarga bo'linadi — faqat PostgreSQL'da, SQLite'da hech narsa qilmaydi.
# Batafsil: apps/core/partitions.py

from django.db import migrations

from apps.core.partitions import monthly_partitioning


class Migration(migrations.Migration):

    dependencies = [
        ('chat', '0002_chatmessage_chat_recipient_partner_idx'),
    ]

    operations = [
        migrations.RunPython(monthly_partitioning('chat.ChatMessage'), migrations.RunPython.noop),
    ]
