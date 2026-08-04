from django.contrib import admin

from .models import Order, OrderVersion


class OrderVersionInline(admin.TabularInline):
    model = OrderVersion
    extra = 0
    fields = ("number", "file", "decision", "reject_reason", "uploaded_by", "created_at")
    readonly_fields = ("created_at",)


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("title", "submitted_by", "status", "priority", "requested_due_date", "created_at")
    list_filter = ("status", "priority")
    search_fields = ("title", "submitted_by__username", "submitted_by__department_name")
    inlines = [OrderVersionInline]
