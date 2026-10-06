# Umumiy tarix (ActivityLog) oylarga bo'linadi — faqat PostgreSQL'da, SQLite'da hech narsa qilmaydi.
# Batafsil: apps/core/partitions.py

from django.db import migrations

from apps.core.partitions import monthly_partitioning


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(monthly_partitioning('core.ActivityLog'), migrations.RunPython.noop),
    ]
