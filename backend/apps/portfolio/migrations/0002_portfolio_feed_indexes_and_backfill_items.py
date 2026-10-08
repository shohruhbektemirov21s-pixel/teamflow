from django.db import migrations, models
from django.db.models import Exists, OuterRef


def backfill_auto_items(apps, schema_editor):
    PortfolioItem = apps.get_model("portfolio", "PortfolioItem")
    ProjectMember = apps.get_model("projects", "ProjectMember")
    missing = ProjectMember.objects.annotate(
        has_item=Exists(PortfolioItem.objects.filter(
            owner_id=OuterRef("developer_id"), project_id=OuterRef("project_id")
        ))
    ).filter(has_item=False).values_list("developer_id", "project_id").iterator()
    batch = []
    for developer_id, project_id in missing:
        batch.append(PortfolioItem(owner_id=developer_id, project_id=project_id))
        if len(batch) >= 1000:
            PortfolioItem.objects.bulk_create(batch, batch_size=1000, ignore_conflicts=True)
            batch = []
    if batch:
        PortfolioItem.objects.bulk_create(batch, batch_size=1000, ignore_conflicts=True)


class Migration(migrations.Migration):
    dependencies = [("portfolio", "0001_initial")]

    operations = [
        migrations.AddIndex(
            model_name="portfolioitem",
            index=models.Index(fields=["owner", "-created_at", "-id"], name="portfolio_owner_feed_idx"),
        ),
        migrations.AddIndex(
            model_name="portfolioreview",
            index=models.Index(fields=["item", "-updated_at", "-id"], name="portfolio_review_feed_idx"),
        ),
        migrations.RunPython(backfill_auto_items, migrations.RunPython.noop),
    ]
