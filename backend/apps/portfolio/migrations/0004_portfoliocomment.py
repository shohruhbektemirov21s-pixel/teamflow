import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


def reviews_text_to_comments(apps, schema_editor):
    """Eski baholardagi sharh matni alohida sharhga ko'chadi (hech narsa yo'qolmaydi)."""
    Review = apps.get_model("portfolio", "PortfolioReview")
    Comment = apps.get_model("portfolio", "PortfolioComment")
    for review in Review.objects.exclude(text="").iterator():
        comment = Comment.objects.create(item_id=review.item_id, author_id=review.author_id, text=review.text)
        # created_at auto_now_add — eski sharh vaqtini saqlaymiz
        Comment.objects.filter(pk=comment.pk).update(created_at=review.updated_at)


def comments_back_to_reviews(apps, schema_editor):
    Review = apps.get_model("portfolio", "PortfolioReview")
    Comment = apps.get_model("portfolio", "PortfolioComment")
    for comment in Comment.objects.order_by("created_at", "id"):
        Review.objects.filter(item_id=comment.item_id, author_id=comment.author_id, text="").update(text=comment.text)


class Migration(migrations.Migration):
    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("portfolio", "0003_portfolioitem_cover_technologies"),
    ]

    operations = [
        migrations.CreateModel(
            name="PortfolioComment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("text", models.TextField(max_length=1000, verbose_name="Sharh")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("author", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="portfolio_comments", to=settings.AUTH_USER_MODEL)),
                ("item", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="comments", to="portfolio.portfolioitem")),
            ],
            options={
                "verbose_name": "Sharh",
                "verbose_name_plural": "Sharhlar",
                "ordering": ["-created_at", "-id"],
                "indexes": [models.Index(fields=["item", "-created_at", "-id"], name="portfolio_comment_feed_idx")],
            },
        ),
        migrations.RunPython(reviews_text_to_comments, comments_back_to_reviews),
        migrations.RemoveField(model_name="portfolioreview", name="text"),
    ]
