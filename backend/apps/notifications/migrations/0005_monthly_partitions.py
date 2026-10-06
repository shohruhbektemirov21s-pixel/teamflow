# Bildirishnomalar oylarga bo'linadi — faqat PostgreSQL'da, SQLite'da hech narsa qilmaydi.
# Batafsil: apps/core/partitions.py

from django.db import migrations

from apps.core.partitions import monthly_partitioning


class Migration(migrations.Migration):

    dependencies = [
        ('notifications', '0004_recipient_created_idx'),
    ]

    operations = [
        migrations.RunPython(monthly_partitioning('notifications.Notification'), migrations.RunPython.noop),
    ]
