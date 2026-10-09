"""Rolga qarab API darajasida bloklash — bitta markaziy qoida.

Oddiy foydalanuvchi (Role.USER) faqat portfolio, o'z profili va auth yo'llariga kira oladi;
boshqa barcha /api/ yo'llari frontendda ham yashirilgan, lekin to'g'ridan-to'g'ri so'rov
yuborilsa ham shu yerda 403 bilan qaytariladi.
"""
from django.http import JsonResponse

from apps.accounts.models import Role

PORTFOLIO_USER_ALLOWED_PREFIXES = (
    "/api/auth/",
    "/api/specialties/",
    "/api/meta/",
    "/api/portfolio",
    "/api/avatars/",
)


class PortfolioOnlyUserMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        user = getattr(request, "user", None)
        if (
            request.path.startswith("/api/")
            and user is not None
            and user.is_authenticated
            and user.role == Role.USER
            and not request.path.startswith(PORTFOLIO_USER_ALLOWED_PREFIXES)
        ):
            return JsonResponse({"detail": "Bu bo'limga ruxsat yo'q."}, status=403)
        return self.get_response(request)
