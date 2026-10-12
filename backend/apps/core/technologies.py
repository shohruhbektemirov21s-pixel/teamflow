"""Texnologiyalar ro'yxati (["Python", "Django"]): portfolio loyihasi va TeamFlow loyihasi uchun bitta qoida."""
from rest_framework import serializers

from .api_utils import JSONListField

TECH_MAX_COUNT = 10
TECH_MAX_LENGTH = 30


class TechnologiesField(JSONListField):
    """Bo'shlar tashlanadi, takrorlar (harf katta-kichikligiga qaramay) bittaga keltiriladi.
    multipart/form-data da JSON matn sifatida ham keladi (`JSONListField`)."""

    def __init__(self, **kwargs):
        kwargs.setdefault("child", serializers.CharField(max_length=TECH_MAX_LENGTH, allow_blank=True))
        kwargs.setdefault("max_length", TECH_MAX_COUNT)
        super().__init__(**kwargs)

    def to_internal_value(self, data):
        seen, result = set(), []
        for name in (value.strip() for value in super().to_internal_value(data)):
            if name and name.lower() not in seen:
                seen.add(name.lower())
                result.append(name)
        return result
