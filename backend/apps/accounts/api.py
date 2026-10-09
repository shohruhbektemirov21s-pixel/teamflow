from django.contrib.auth import authenticate, login, logout
from django.http import FileResponse, Http404
from django.shortcuts import get_object_or_404
from django.db.models import Case, IntegerField, Q, Value, When
from django.views.decorators.csrf import csrf_protect, ensure_csrf_cookie
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.exceptions import ValidationError
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.core.api_utils import ServiceError, avatar_url

from . import services
from .models import Role, Specialty, User
from .throttles import LOGIN_THROTTLES, AuthThrottle
from .serializers import (
    LoginSerializer, MeSerializer, RegisterSerializer, SpecialtySerializer,
    ProfileSerializer, ProfileUpdateSerializer, ChangePasswordSerializer, BusinessTripSerializer, ResponsibilitiesSerializer
)


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
@throttle_classes(LOGIN_THROTTLES)
@csrf_protect
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
    """Vazifa/loyiha formalarida tanlash uchun faol dasturchilar. Dasturchi ham oladi — vazifa oynasida
    o'z vazifasiga yoki sub-vazifaga boshqa dasturchini qo'shadi."""
    if not (request.user.is_manager or request.user.is_developer):
        raise PermissionDenied("Ruxsat yo'q.")
    qs = User.objects.filter(is_active=True, role=Role.DEVELOPER).select_related("specialty")
    q = request.query_params.get("q", "").strip()[:200]
    raw_ids = request.query_params.get("ids", "")
    try:
        ids = sorted({int(value) for value in raw_ids.split(",") if value})
        if len(ids) > 200 or any(value < 1 for value in ids):
            raise ValueError
    except ValueError:
        raise ValidationError("Ijrochilar ro'yxati noto'g'ri (ko'pi bilan 200 ta).")
    if q:
        qs = qs.filter(Q(first_name__icontains=q) | Q(last_name__icontains=q) | Q(specialty__name__icontains=q) | Q(pk__in=ids))
    qs = qs.annotate(selected_first=Case(When(pk__in=ids, then=Value(0)), default=Value(1), output_field=IntegerField()))
    return Response(
        [
            {"id": u.pk, "full_name": u.full_name, "specialty": u.specialty.name if u.specialty else "",
             "avatar": avatar_url(u), "business_trip_return_date": u.business_trip_return_date,
             "is_on_business_trip": u.is_on_business_trip}
            for u in qs.order_by("selected_first", "first_name", "last_name", "pk")[:200]
        ]
    )


@api_view(["PATCH"])
@permission_classes([IsAuthenticated])
def responsibilities(request, pk):
    if not request.user.is_manager:
        raise PermissionDenied("Mas'uliyatlarni faqat Boshliq yoki PM tahrirlaydi.")
    employees = User.objects.filter(is_active=True).exclude(role="")
    if not request.user.is_boss:
        employees = employees.filter(role=Role.DEVELOPER)
    employee = get_object_or_404(employees, pk=pk)
    serializer = ResponsibilitiesSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    employee = services.set_responsibilities(request.user, employee, serializer.validated_data["responsibilities"])
    return Response({"id": employee.pk, "responsibilities": employee.responsibilities})


@api_view(["PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def business_trip(request, pk):
    if not request.user.is_boss:
        raise PermissionDenied("Xizmat safarini faqat boshliq boshqaradi.")
    employee = get_object_or_404(User, pk=pk, is_active=True, role__in=[Role.PM, Role.DEVELOPER])
    if request.method == "PUT":
        serializer = BusinessTripSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        employee = services.set_business_trip(request.user, employee, serializer.validated_data["return_date"])
    else:
        employee = services.end_business_trip(request.user, employee)
    return Response({
        "id": employee.pk,
        "business_trip_return_date": employee.business_trip_return_date,
        "is_on_business_trip": employee.is_on_business_trip,
    })


@api_view(["GET", "PATCH"])
@permission_classes([IsAuthenticated])
def profile(request):
    """Joriy foydalanuvchi profili. PATCH: first_name, last_name, telegram_username.

    Telegram username o'zgarsa, eski chat uziladi — bildirishnomalar begona chatga ketmasin;
    foydalanuvchi botga /start ni qayta yuboradi.
    """
    if request.method == "GET":
        return Response(ProfileSerializer(request.user).data)
    s = ProfileUpdateSerializer(data=request.data, context={"request": request})
    s.is_valid(raise_exception=True)
    user = request.user
    fields = list(s.validated_data.keys())
    if "telegram_username" in s.validated_data and s.validated_data["telegram_username"] != user.telegram_username:
        user.telegram_chat_id = ""
        fields.append("telegram_chat_id")
    for k, v in s.validated_data.items():
        setattr(user, k, v)
    user.save(update_fields=fields)
    return Response(ProfileSerializer(request.user).data)


@api_view(["POST", "DELETE"])
@permission_classes([IsAuthenticated])
def avatar(request):
    """O'z profil rasmi: POST (multipart `avatar`) — yuklash/almashtirish, DELETE — o'chirish."""
    if request.method == "DELETE":
        services.remove_avatar(request.user)
    else:
        upload = request.FILES.get("avatar")
        if upload is None:
            raise ServiceError("Rasm tanlang.", "avatar")
        services.set_avatar(request.user, upload)
    return Response(ProfileSerializer(request.user).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def avatar_image(request, pk):
    """Profil rasmi — faqat tizimga kirganlarga (media papkasi ochiq berilmaydi)."""
    user = User.objects.filter(pk=pk, is_active=True).first()
    if user is None or not user.avatar:
        raise Http404
    try:
        handle = user.avatar.open("rb")
    except (FileNotFoundError, ValueError):
        raise Http404
    response = FileResponse(handle, content_type="image/jpeg")
    response["X-Content-Type-Options"] = "nosniff"
    response["Cache-Control"] = "private, max-age=86400"  # `?v=` almashadi — eski rasm keshda qolmaydi
    return response


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
