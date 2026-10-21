"""0004: eski baho matni alohida sharhga ko'chadi, ma'lumot yo'qolmaydi."""
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase

from apps.accounts.models import Role
from apps.panel.tests.factories import make_user

BEFORE = [("portfolio", "0003_portfolioitem_cover_technologies")]
AFTER = [("portfolio", "0004_portfoliocomment")]


class ReviewTextToCommentsMigrationTests(TransactionTestCase):
    def migrate(self, target):
        executor = MigrationExecutor(connection)
        executor.migrate(target)
        return executor.loader.project_state(target).apps

    def tearDown(self):
        self.migrate(AFTER)  # keyingi testlar uchun sxema oxirgi holatda qolsin

    def test_review_text_moves_to_comment_and_rating_stays(self):
        old = self.migrate(BEFORE)
        Item, Review = old.get_model("portfolio", "PortfolioItem"), old.get_model("portfolio", "PortfolioReview")
        dev, rater, silent = make_user(Role.DEVELOPER), make_user(Role.PM), make_user(Role.PM)
        item = Item.objects.create(owner_id=dev.pk, title="Sayt")
        Review.objects.create(item=item, author_id=rater.pk, stars=4, text="Zo'r ish")
        Review.objects.create(item=item, author_id=silent.pk, stars=3, text="")

        new = self.migrate(AFTER)
        Comment, NewReview = new.get_model("portfolio", "PortfolioComment"), new.get_model("portfolio", "PortfolioReview")
        comments = list(Comment.objects.all())
        self.assertEqual([(c.item_id, c.author_id, c.text) for c in comments], [(item.pk, rater.pk, "Zo'r ish")])
        self.assertEqual(sorted(NewReview.objects.values_list("stars", flat=True)), [3, 4])
