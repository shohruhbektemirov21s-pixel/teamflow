from django.contrib import admin

from .models import Follow, PortfolioItem, PortfolioReview, PortfolioVideo


class PortfolioVideoInline(admin.TabularInline):
    model = PortfolioVideo
    extra = 0


@admin.register(PortfolioItem)
class PortfolioItemAdmin(admin.ModelAdmin):
    list_display = ["__str__", "owner", "project", "created_at"]
    list_select_related = ["owner", "project"]
    search_fields = ["title", "project__name", "owner__first_name", "owner__last_name"]
    raw_id_fields = ["owner", "project"]
    inlines = [PortfolioVideoInline]


@admin.register(PortfolioReview)
class PortfolioReviewAdmin(admin.ModelAdmin):
    list_display = ["item", "author", "stars", "updated_at"]
    list_filter = ["stars"]
    raw_id_fields = ["item", "author"]


@admin.register(Follow)
class FollowAdmin(admin.ModelAdmin):
    list_display = ["follower", "developer", "created_at"]
    raw_id_fields = ["follower", "developer"]
