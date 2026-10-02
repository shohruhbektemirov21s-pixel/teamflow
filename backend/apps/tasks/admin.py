from django.contrib import admin

from .models import SubTask, Submission, SubmissionFile, Task, TaskAssignment, TaskFile


class TaskAssignmentInline(admin.TabularInline):
    model = TaskAssignment
    extra = 0
    autocomplete_fields = ("developer",)


class SubTaskInline(admin.TabularInline):
    model = SubTask
    extra = 0
    autocomplete_fields = ("assignees",)


class TaskFileInline(admin.TabularInline):
    model = TaskFile
    extra = 0
    fields = ("file", "original_name", "uploaded_by")


@admin.register(Task)
class TaskAdmin(admin.ModelAdmin):
    list_display = ("code", "title", "project", "status", "priority", "due_at", "completed_at")
    list_filter = ("status", "priority", "project")
    search_fields = ("code", "title", "project__name")
    inlines = [TaskAssignmentInline, SubTaskInline, TaskFileInline]


class SubmissionFileInline(admin.TabularInline):
    model = SubmissionFile
    extra = 0


@admin.register(Submission)
class SubmissionAdmin(admin.ModelAdmin):
    list_display = ("task", "round", "submitted_by", "decision", "submitted_at")
    list_filter = ("decision",)
    inlines = [SubmissionFileInline]
