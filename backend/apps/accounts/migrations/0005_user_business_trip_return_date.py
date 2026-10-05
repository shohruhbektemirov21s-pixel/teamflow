from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("accounts", "0004_user_avatar")]

    operations = [
        migrations.AddField(
            model_name="user",
            name="business_trip_return_date",
            field=models.DateField(blank=True, null=True, verbose_name="Xizmat safaridan qaytish sanasi"),
        ),
    ]
