from django.contrib import admin

from .models import Project, ProjectFile, ProjectMember


class ProjectMemberInline(admin.TabularInline):
    model = ProjectMember
    extra = 0
    autocomplete_fields = ("developer",)


class ProjectFileInline(admin.TabularInline):
    model = ProjectFile
    extra = 0
    fields = ("file", "original_name", "uploaded_by")


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "stage", "start_date", "end_date", "created_by")
    list_filter = ("stage",)
    search_fields = ("code", "name")
    inlines = [ProjectMemberInline, ProjectFileInline]
