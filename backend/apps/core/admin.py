from django.contrib import admin

from .models import ActivityLog, Comment


@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    list_display = ("author", "target_type", "target_id", "created_at")
    list_filter = ("target_type",)
    search_fields = ("text", "author__username")


@admin.register(ActivityLog)
class ActivityLogAdmin(admin.ModelAdmin):
    list_display = ("created_at", "actor", "verb", "message")
    list_filter = ("verb",)
    search_fields = ("message", "actor__username")
