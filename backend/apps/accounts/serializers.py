from django.contrib.auth import password_validation
from django.utils import timezone
from rest_framework import serializers

from .models import Role, Specialty, User

SELF_REGISTER_ROLES = [Role.PM, Role.DEVELOPER, Role.DEPARTMENT]  # Boshliq faqat Django adminda


def normalize_telegram(value):
    """Telegram username bir xil shaklda saqlanadi: "@username" (bo'sh bo'lishi mumkin)."""
    value = (value or "").strip()
    return f"@{value.lstrip('@')}" if value else ""


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

    class Meta:
        model = User
        fields = [
            "id", "username", "first_name", "last_name", "full_name",
            "role", "role_label", "specialty", "department_name", "telegram_username",
        ]


class ProfileSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    role_label = serializers.CharField(source="get_role_display", read_only=True)
    specialty = serializers.StringRelatedField()
    stats = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "username", "first_name", "last_name", "full_name",
            "role", "role_label", "specialty", "department_name",
            "telegram_username", "date_joined", "stats",
        ]

    def get_stats(self, user):
        from apps.tasks.models import Task
        from django.db.models import Q
        if not user.is_developer:
            return None
        qs = Task.objects.filter(assignments__developer=user)
        return {
            "active": qs.filter(status__in=["control", "in_progress"]).count(),
            "in_review": qs.filter(status="in_review").count(),
            "done": qs.filter(status="done").count(),
            "overdue": qs.filter(status__in=["control", "in_progress"], due_at__lt=timezone.now()).count(),
        }


class ProfileUpdateSerializer(serializers.Serializer):
    first_name = serializers.CharField(max_length=150, required=False)
    last_name = serializers.CharField(max_length=150, required=False)
    telegram_username = serializers.CharField(max_length=100, required=False, allow_blank=True)

    def validate_telegram_username(self, value):
        return normalize_telegram(value)


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
