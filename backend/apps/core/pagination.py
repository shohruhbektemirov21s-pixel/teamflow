from django.conf import settings
from rest_framework.exceptions import ValidationError
from rest_framework.pagination import PageNumberPagination


class BoundedPagination(PageNumberPagination):
    page_size = 50
    page_size_query_param = "page_size"
    max_page_size = 100


def bounded_unpaged(queryset):
    """Compatibility for old clients, never silently truncate a list."""
    limit = getattr(settings, "MAX_UNPAGED_ROWS", 1000)
    rows = list(queryset[:limit + 1])
    if len(rows) > limit:
        raise ValidationError("Ro'yxat katta. Sahifalab yuklang (all=1 parametrini olib tashlang).")
    return rows
