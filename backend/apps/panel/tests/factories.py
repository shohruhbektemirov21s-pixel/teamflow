"""Testlar uchun umumiy yordamchilar."""
from datetime import date, timedelta

from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from rest_framework.test import APIClient

from apps.accounts.models import Role, Specialty, User

_counter = [0]


def make_user(role, active=True, **kw):
    _counter[0] += 1
    n = _counter[0]
    data = {"username": f"{role}{n}", "first_name": f"Ism{n}", "last_name": "Familiya", "role": role,
            "is_active": active}
    if role == Role.DEPARTMENT:
        data["department_name"] = f"Boshqarma {n}"
    data.update(kw)
    user = User(**data)
    user.set_password("Parol-12345")
    user.save()
    return user


def client_for(user):
    c = APIClient()
    c.force_authenticate(user)
    return c


def docx(name="tz.docx", size=100):
    return SimpleUploadedFile(name, b"x" * size, content_type="application/octet-stream")


def specialty(name="Backend"):
    return Specialty.objects.get_or_create(name=name)[0]


def today():
    return timezone.localdate()


def dates(days=10):
    return {"start_date": str(today()), "end_date": str(today() + timedelta(days=days))}


def future(days=5):
    return date.today() + timedelta(days=days)
