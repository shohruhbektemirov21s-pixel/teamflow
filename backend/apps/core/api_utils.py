"""API qatlami uchun umumiy yordamchilar."""
import json

from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import permissions, serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.views import exception_handler

from .workflow import TransitionError


class ServiceError(Exception):
    """Servis qatlamidagi biznes-qoida buzilishi (400)."""

    def __init__(self, detail, field=None):
        super().__init__(detail)
        self.detail = detail
        self.field = field


def api_exception_handler(exc, context):
    """Barcha xatolar bir xil shaklda: {"detail": "...", "fields": {...}}."""
    if isinstance(exc, TransitionError):
        return Response({"detail": str(exc)}, status=400)
    if isinstance(exc, ServiceError):
        body = {"detail": exc.detail}
        if exc.field:
            body["fields"] = {exc.field: [exc.detail]}
        return Response(body, status=400)
    if isinstance(exc, DjangoValidationError):
        fields = exc.message_dict if hasattr(exc, "error_dict") else None
        detail = "Ma'lumotlarni tekshiring." if fields else " ".join(exc.messages)
        body = {"detail": detail}
        if fields:
            body["fields"] = fields
        return Response(body, status=400)

    response = exception_handler(exc, context)
    if response is not None and isinstance(response.data, dict) and "detail" not in response.data:
        response.data = {"detail": "Ma'lumotlarni tekshiring.", "fields": response.data}
    elif response is not None and isinstance(response.data, list):
        response.data = {"detail": " ".join(str(x) for x in response.data)}
    return response


class IsManager(permissions.BasePermission):
    """PM yoki Boshliq."""

    message = "Bu amal faqat loyiha menejeri yoki boshliq uchun."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_manager)


class IsDepartment(permissions.BasePermission):
    message = "Bu amal faqat boshqarma uchun."

    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.is_department)


def require_manager(user):
    if not user.is_manager:
        raise PermissionDenied(IsManager.message)


def file_info(obj, kind):
    """Fayl ma'lumoti. Yuklab olish faqat himoyalangan `/api/files/<kind>/<id>/` orqali (apps.core.files_api)."""
    try:
        size = obj.file.size
    except (OSError, ValueError):
        size = None
    return {"id": obj.pk, "name": obj.original_name, "size": size, "url": f"/api/files/{kind}/{obj.pk}/"}


class UserBriefField(serializers.Field):
    """Foydalanuvchining qisqa ko'rinishi (faqat o'qish)."""

    def __init__(self, **kwargs):
        kwargs["read_only"] = True
        super().__init__(**kwargs)

    def to_representation(self, user):
        return user_brief(user)


def avatar_url(user):
    """Profil rasmi manzili (faqat kirganlarga beriladi). `v` — rasm almashsa brauzer keshi yangilanadi."""
    if not user.avatar:
        return None
    version = user.avatar.name.rsplit("/", 1)[-1].split(".")[0][:12]
    return f"/api/avatars/{user.pk}/?v={version}"


def user_brief(user):
    if user is None:
        return None
    return {
        "id": user.pk,
        "full_name": user.full_name,
        "role": user.role,
        "department_name": user.department_name,
        "avatar": avatar_url(user),
        "business_trip_return_date": user.business_trip_return_date,
        "is_on_business_trip": user.is_on_business_trip,
    }


class JSONListField(serializers.ListField):
    """multipart/form-data da ro'yxat JSON matn sifatida keladi: member_ids='[1,2]'."""

    def to_internal_value(self, data):
        if isinstance(data, list) and len(data) == 1 and isinstance(data[0], str) and data[0].startswith("["):
            data = data[0]
        if isinstance(data, str):
            try:
                data = json.loads(data or "[]")
            except ValueError:
                raise serializers.ValidationError("Noto'g'ri ro'yxat.")
        return super().to_internal_value(data)
