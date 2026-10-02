from django.contrib.auth import password_validation
from rest_framework import serializers

from apps.core.api_utils import avatar_url

from .models import Role, Specialty, User

SELF_REGISTER_ROLES = [Role.PM, Role.DEVELOPER, Role.DEPARTMENT]  # Boshliq faqat Django adminda


def normalize_telegram(value):
    """Telegram username bir xil shaklda saqlanadi: "@username" (bo'sh bo'lishi mumkin)."""
    value = (value or "").strip().lstrip("@")
    return f"@{value}" if value else ""


TELEGRAM_TAKEN = "Bu Telegram username boshqa akkauntda yozilgan. O'zingizning username'ingizni yozing."


def telegram_taken(value, exclude_pk=None):
    """Bitta Telegram username faqat bitta akkauntda bo'ladi — aks holda bot chatni bog'lay olmaydi."""
    return bool(value) and User.objects.filter(telegram_username__iexact=value).exclude(pk=exclude_pk).exists()


class SpecialtySerializer(serializers.ModelSerializer):
    class Meta:
        model = Specialty
        fields = ["id", "name"]


class RegisterSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=150)
    last_name = serializers.CharField(max_length=150)
    specialty = serializers.PrimaryKeyRelatedField(queryset=Specialty.objects.filter(is_active=True))
    role = serializers.ChoiceField(choices=[(r.value, r.label) for r in SELF_REGISTER_ROLES])
    department_name = serializers.CharField(max_length=200, required=False, allow_blank=True, default="")
    telegram_username = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    username = serializers.RegexField(
        r"^[A-Za-z0-9_.-]{3,150}$",
        error_messages={"invalid": "Login 3–150 belgi: lotin harflari, raqam, _ . - bo'lishi mumkin."},
    )
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_username(self, value):
        if User.objects.filter(username__iexact=value).exists():
            raise serializers.ValidationError("Bu login band. Boshqasini tanlang.")
        return value

    def validate(self, attrs):
        dept = attrs.get("department_name", "").strip()
        telegram = attrs.get("telegram_username", "").strip()
        if attrs["role"] == Role.DEPARTMENT and not dept:
            raise serializers.ValidationError({"department_name": ["Boshqarma nomini yozing."]})
        attrs["department_name"] = dept if attrs["role"] == Role.DEPARTMENT else ""
        
        attrs["telegram_username"] = normalize_telegram(telegram)
        if telegram_taken(attrs["telegram_username"]):
            raise serializers.ValidationError({"telegram_username": [TELEGRAM_TAKEN]})

        candidate = User(
            username=attrs["username"], first_name=attrs["first_name"], last_name=attrs["last_name"]
        )
        try:
            password_validation.validate_password(attrs["password"], candidate)
        except Exception as exc:  # django ValidationError
            raise serializers.ValidationError({"password": list(exc.messages)})
        return attrs

    def create(self, validated):
        password = validated.pop("password")
        user = User(**validated, is_active=False)  # admin tasdiqlaguncha kira olmaydi
        user.set_password(password)
        user.save()
        return user


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(trim_whitespace=False)


class MeSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    role_label = serializers.CharField(source="get_role_display", read_only=True)
    specialty = serializers.StringRelatedField()
    avatar = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "username", "first_name", "last_name", "full_name",
            "role", "role_label", "specialty", "department_name", "telegram_username", "avatar",
        ]

    def get_avatar(self, obj):
        return avatar_url(obj)


class ProfileSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    role_label = serializers.CharField(source="get_role_display", read_only=True)
    specialty = serializers.StringRelatedField()
    stats = serializers.SerializerMethodField()
    avatar = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "username", "first_name", "last_name", "full_name",
            "role", "role_label", "specialty", "department_name",
            "telegram_username", "date_joined", "stats", "avatar",
        ]

    def get_avatar(self, obj):
        return avatar_url(obj)

    def get_stats(self, user):
        # "Faol" va "Muddati o'tgan" — bosh panel va xodim oynasi bilan bir xil qoida (tasks.filters.apply_bucket)
        from apps.tasks.filters import apply_bucket
        from apps.tasks.models import Task
        if not user.is_developer:
            return None
        qs = Task.objects.filter(assignments__developer=user, archived_at__isnull=True)
        return {
            "active": apply_bucket(qs, "active").count(),
            "in_review": qs.filter(status=Task.Status.IN_REVIEW).count(),
            "done": qs.filter(status=Task.Status.DONE).count(),
            "overdue": apply_bucket(qs, "overdue").count(),
        }


class ProfileUpdateSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=150, required=False)
    last_name = serializers.CharField(max_length=150, required=False)
    telegram_username = serializers.CharField(max_length=100, required=False, allow_blank=True)

    def validate_telegram_username(self, value):
        value = normalize_telegram(value)
        if telegram_taken(value, exclude_pk=self.context["request"].user.pk):
            raise serializers.ValidationError(TELEGRAM_TAKEN)
        return value


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField()
    new_password = serializers.CharField()

    def validate_current_password(self, value):
        if not self.context["request"].user.check_password(value):
            raise serializers.ValidationError("Joriy parol noto'g'ri.")
        return value

    def validate_new_password(self, value):
        from django.contrib.auth import password_validation
        try:
            password_validation.validate_password(value, self.context["request"].user)
        except Exception as exc:
            raise serializers.ValidationError(list(exc.messages))
        return value
