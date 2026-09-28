from django.contrib.auth import authenticate, login, logout
from django.views.decorators.csrf import ensure_csrf_cookie
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

from apps.core.api_utils import require_manager

from .models import Role, Specialty, User
from .serializers import (
    LoginSerializer, MeSerializer, RegisterSerializer, SpecialtySerializer,
    ProfileSerializer, ProfileUpdateSerializer, ChangePasswordSerializer
)


class AuthThrottle(AnonRateThrottle):
    scope = "auth"


@api_view(["GET"])
@permission_classes([AllowAny])
@ensure_csrf_cookie
def csrf(request):
    """SPA ishga tushganda chaqiriladi: `csrftoken` cookie o'rnatiladi."""
    return Response({"ok": True})


@api_view(["GET"])
@permission_classes([AllowAny])
def specialties(request):
    return Response(SpecialtySerializer(Specialty.objects.filter(is_active=True), many=True).data)


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([AuthThrottle])
def register(request):
    serializer = RegisterSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    serializer.save()
    return Response(
        {"detail": "Ro'yxatdan o'tdingiz. Administrator tasdiqlagach tizimga kira olasiz."},
        status=status.HTTP_201_CREATED,
    )


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([AuthThrottle])
def login_view(request):
    serializer = LoginSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    username = serializer.validated_data["username"]
    password = serializer.validated_data["password"]
    user = authenticate(request, username=username, password=password)
    if user is None:
        # Parol to'g'ri, lekin akkaunt hali tasdiqlanmagan — foydalanuvchiga aniq aytamiz.
        pending = User.objects.filter(username=username, is_active=False).first()
        if pending and pending.check_password(password):
            return Response(
                {"detail": "Akkauntingiz hali tasdiqlanmagan. Administrator tasdiqlashini kuting.", "code": "not_approved"},
                status=status.HTTP_403_FORBIDDEN,
            )
        return Response({"detail": "Login yoki parol noto'g'ri."}, status=status.HTTP_400_BAD_REQUEST)
    if not user.role:
        return Response(
            {"detail": "Akkauntingizga rol biriktirilmagan. Administratorga murojaat qiling."},
            status=status.HTTP_403_FORBIDDEN,
        )
    login(request, user)
    return Response(MeSerializer(user).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def logout_view(request):
    logout(request)
    return Response({"ok": True})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    return Response(MeSerializer(request.user).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def developers(request):
    """Vazifa/loyiha formalarida tanlash uchun faol dasturchilar."""
    require_manager(request.user)
    qs = User.objects.filter(is_active=True, role=Role.DEVELOPER).select_related("specialty")
    return Response(
        [
            {"id": u.pk, "full_name": u.full_name, "specialty": u.specialty.name if u.specialty else ""}
            for u in qs.order_by("first_name", "last_name")
        ]
    )


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def profile(request):
    """Joriy foydalanuvchi profili. PATCH: first_name, last_name o'zgartirish."""
    if request.method == "GET":
        return Response(ProfileSerializer(request.user).data)
    s = ProfileUpdateSerializer(data=request.data)
    s.is_valid(raise_exception=True)
    for k, v in s.validated_data.items():
        setattr(request.user, k, v)
    request.user.save(update_fields=list(s.validated_data.keys()))
    return Response(ProfileSerializer(request.user).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def change_password(request):
    s = ChangePasswordSerializer(data=request.data, context={"request": request})
    s.is_valid(raise_exception=True)
    request.user.set_password(s.validated_data["new_password"])
    request.user.save()
    # Sessiyani yangilash (chiqarib yubormaslik uchun)
    from django.contrib.auth import update_session_auth_hash
    update_session_auth_hash(request, request.user)
    return Response({"detail": "Parol muvaffaqiyatli o'zgartirildi."})
