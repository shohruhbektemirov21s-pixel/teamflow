"""So'rov chegaralari (DRF throttling). Hisoblagichlar keshda — prod'da Redis, barcha jarayonlar uchun umumiy.

Kalit IP emas: ofisda minglab xodim bitta NAT IP orqali chiqadi, IP bo'yicha cheklov hammani birdan bloklaydi.
"""
import hashlib

from rest_framework.throttling import AnonRateThrottle, SimpleRateThrottle, UserRateThrottle


class UserThrottle(UserRateThrottle):
    """Umumiy chegara: faqat kirgan foydalanuvchi, kalit — user id. Anonim so'rovlar (login sahifasi,
    `meta`, `csrf`) bu yerda cheklanmaydi — ular uchun alohida `AuthIpThrottle`/`LoginThrottle`."""

    def get_cache_key(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return None
        return self.cache_format % {"scope": self.scope, "ident": request.user.pk}


class AuthIpThrottle(AnonRateThrottle):
    """Ro'yxatdan o'tish — IP bo'yicha (kamdan-kam amal, ofis bir vaqtda ro'yxatdan o'tmaydi)."""

    scope = "auth"


class FailedLoginIpThrottle(SimpleRateThrottle):
    """IP bo'yicha faqat **muvaffaqiyatsiz** login urinishlari sanaladi (`record_failure`).

    To'g'ri loginlar hisobga kirmaydi — ertalab NAT ortidagi butun ofis bemalol kiradi; bitta IP'dan
    ko'p login nomlarini bitta parol bilan sinab chiqish (password spraying) esa to'xtatiladi.
    """

    scope = "login_failures_ip"

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}

    def _recent(self, key):
        return [t for t in self.cache.get(key, []) if t > self.timer() - self.duration]

    def allow_request(self, request, view):
        if self.rate is None:
            return True
        self.key = self.get_cache_key(request, view)
        self.history = self._recent(self.key)
        self.now = self.timer()
        if len(self.history) >= self.num_requests:
            return self.throttle_failure()
        return True  # urinish shu yerda yozilmaydi — faqat xato bo'lsa (record_failure)

    @classmethod
    def record_failure(cls, request):
        throttle = cls()
        if throttle.rate is None:
            return
        key = throttle.get_cache_key(request, None)
        history = throttle._recent(key)
        history.insert(0, throttle.timer())
        throttle.cache.set(key, history, throttle.duration)


class LoginThrottle(SimpleRateThrottle):
    """Parol tanlashga qarshi: bitta login nomiga daqiqada N urinish (qaysi IP'dan bo'lishidan qat'i nazar)."""

    scope = "login"

    def get_cache_key(self, request, view):
        username = str(request.data.get("username", "")).strip().lower()
        if not username:
            return None
        ident = hashlib.sha256(username.encode()).hexdigest()  # kalitda login nomi ochiq turmasin
        return self.cache_format % {"scope": self.scope, "ident": ident}
