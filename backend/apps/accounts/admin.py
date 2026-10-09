from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from .models import Specialty, User


@admin.register(Specialty)
class SpecialtyAdmin(admin.ModelAdmin):
    list_display = ("name", "is_active")
    list_filter = ("is_active",)
    search_fields = ("name",)


@admin.action(description="Tanlanganlarni tasdiqlash (faollashtirish)")
def approve_users(modeladmin, request, queryset):
    updated = queryset.filter(is_active=False).update(is_active=True)
    modeladmin.message_user(request, f"Tasdiqlandi: {updated} ta foydalanuvchi.")


@admin.action(description="Tanlanganlarni bloklash")
def block_users(modeladmin, request, queryset):
    # O'zini bloklab qo'yishning oldi olinadi.
    updated = queryset.exclude(pk=request.user.pk).update(is_active=False)
    modeladmin.message_user(request, f"Bloklandi: {updated} ta foydalanuvchi.")


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    list_display = ("username", "full_name", "role", "specialty", "department_name", "is_active", "date_joined")
    list_filter = ("is_active", "role", "specialty")
    search_fields = ("username", "first_name", "last_name", "department_name")
    ordering = ("is_active", "-date_joined")  # tasdiqlanmaganlar tepada
    actions = [approve_users, block_users]

    fieldsets = DjangoUserAdmin.fieldsets + (
        ("TeamFlow", {"fields": ("role", "specialty", "department_name", "responsibilities", "technologies")}),
    )
    add_fieldsets = DjangoUserAdmin.add_fieldsets + (
        ("TeamFlow", {"fields": ("first_name", "last_name", "role", "specialty", "department_name")}),
    )
