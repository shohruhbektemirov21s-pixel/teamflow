from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("notifications", "0004_telegramdelivery_notification_notification_feed_idx_and_more")]

    operations = [
        migrations.RemoveIndex(model_name="notification", name="notificatio_recipie_4e3567_idx"),
        migrations.AddIndex(
            model_name="notification",
            index=models.Index(fields=["recipient", "is_read", "-created_at", "-id"], name="notification_unread_feed_idx"),
        ),
    ]
