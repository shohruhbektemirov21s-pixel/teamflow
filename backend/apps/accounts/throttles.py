import hashlib

from django.contrib import admin
from django.http import HttpResponse
from rest_framework.throttling import SimpleRateThrottle


class AuthThrottle(SimpleRateThrottle):
    """IP bo'yicha. Tizimga kirgan foydalanuvchiga ham qo'llanadi (AnonRateThrottle qo'llamasdi).
    IP `REST_FRAMEWORK["NUM_PROXIES"]` bilan aniqlanadi — soxta `X-Forwarded-For` yangi limit bermaydi."""

    scope = "auth"

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


class LoginUsernameThrottle(SimpleRateThrottle):
    """Bitta login uchun urinishlar — IP almashtirib parol tanlashni to'xtatadi."""

    scope = "login_user"

    def get_cache_key(self, request, view):
        data = getattr(request, "data", None) or request.POST
        username = str(data.get("username", "")).strip().lower()
        if not username:
            return None
        ident = hashlib.sha256(username.encode()).hexdigest()
        return self.cache_format % {"scope": self.scope, "ident": ident}


LOGIN_THROTTLES = [AuthThrottle, LoginUsernameThrottle]


def throttled_admin_login(request, extra_context=None):
    """`/admin/login/` — API login bilan bir xil cheklov."""
    if request.method == "POST":
        for throttle in LOGIN_THROTTLES:
            if not throttle().allow_request(request, None):
                return HttpResponse("Urinishlar juda ko'p. Birozdan keyin qayta urinib ko'ring.", status=429)
    return admin.site.login(request, extra_context)
