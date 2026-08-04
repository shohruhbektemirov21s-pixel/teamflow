from django.contrib.auth import password_validation
from rest_framework import serializers

from .models import Role, Specialty, User

SELF_REGISTER_ROLES = [Role.PM, Role.DEVELOPER, Role.DEPARTMENT]  # Boshliq faqat Django adminda


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
        if attrs["role"] == Role.DEPARTMENT and not dept:
            raise serializers.ValidationError({"department_name": ["Boshqarma nomini yozing."]})
        attrs["department_name"] = dept if attrs["role"] == Role.DEPARTMENT else ""
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
            "role", "role_label", "specialty", "department_name",
        ]
