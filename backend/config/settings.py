import os
import sys
import tempfile
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


def _load_env_file(path):
    """`backend/.env` (gitga tushmaydi): `KALIT=qiymat` qatorlari. Haqiqiy muhit o'zgaruvchisi ustun turadi."""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


_load_env_file(BASE_DIR / ".env")

DEBUG = os.environ.get("DJANGO_DEBUG", "1") == "1"

# Prod'da SECRET_KEY muhit o'zgaruvchisidan olinadi; dev uchun zaxira qiymat.
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-only-insecure-key-change-me")
if not DEBUG and SECRET_KEY == "dev-only-insecure-key-change-me":
    raise RuntimeError("DJANGO_SECRET_KEY muhit o'zgaruvchisi o'rnatilmagan")

ALLOWED_HOSTS = [h for h in os.environ.get("DJANGO_ALLOWED_HOSTS", "localhost,127.0.0.1").split(",") if h]
CSRF_TRUSTED_ORIGINS = [
    o
    for o in os.environ.get(
        "DJANGO_CSRF_TRUSTED_ORIGINS",
        "http://127.0.0.1:5173,http://localhost:5173,http://127.0.0.1:8020,http://localhost:8020",
    ).split(",")
    if o
]

INSTALLED_APPS = [
    "daphne",  # `runserver` ASGI (HTTP + WebSocket) bo'lib ishlaydi — dev va Windows server uchun
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "channels",
    "apps.core",
    "apps.accounts",
    "apps.orders",
    "apps.projects",
    "apps.tasks",
    "apps.notifications",
    "apps.suggestions",
    "apps.chat",
    "apps.panel",
    "apps.ai",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"  # prod HTTP: gunicorn
ASGI_APPLICATION = "config.asgi.application"  # WebSocket (prod: daphne), dev: runserver ikkalasini ham

# Baza: `POSTGRES_DB` berilsa PostgreSQL (prod, Docker), aks holda SQLite (dev, Windows server).
if os.environ.get("POSTGRES_DB"):
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.environ["POSTGRES_DB"],
            "USER": os.environ.get("POSTGRES_USER", "teamflow"),
            "PASSWORD": os.environ.get("POSTGRES_PASSWORD", ""),
            "HOST": os.environ.get("POSTGRES_HOST", "postgres"),
            "PORT": os.environ.get("POSTGRES_PORT", "5432"),
            # Puldan olingan ulanish tekshiriladi — PostgreSQL qayta ishga tushsa eskisi tashlanadi
            "CONN_HEALTH_CHECKS": True,
            "OPTIONS": {
                "connect_timeout": 5,
                # Har jarayonda kichik ulanishlar puli (psycopg_pool): har so'rovda yangi ulanish ochilmaydi,
                # jami ulanishlar soni = jarayonlar × max_size — PostgreSQL'ning `max_connections` dan oshmasin.
                "pool": {
                    "min_size": 1,
                    "max_size": int(os.environ.get("DJANGO_DB_POOL_MAX", "8")),
                    "timeout": 10,
                },
            },
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": BASE_DIR / "db.sqlite3",
            "OPTIONS": {
                # WAL: o'qish yozishni kutmaydi; IMMEDIATE + timeout: "database is locked" o'rniga navbat kutadi.
                "init_command": "PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;",
                "transaction_mode": "IMMEDIATE",
                "timeout": 20,
            },
        }
    }

# Redis: kesh, sessiyalar, throttling hisoblagichlari va WebSocket kanallari — barcha jarayonlar uchun umumiy.
# Berilmasa (dev) — jarayon ichidagi xotira.
REDIS_URL = os.environ.get("REDIS_URL", "")
if REDIS_URL:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.redis.RedisCache",
            "LOCATION": REDIS_URL,
            "KEY_PREFIX": "tf",
            "TIMEOUT": 300,
        }
    }
    # Sessiya Redis'dan o'qiladi (har so'rovda bazaga tushmaydi), bazada ham saqlanadi (Redis tozalansa chiqib ketmaydi).
    SESSION_ENGINE = "django.contrib.sessions.backends.cached_db"
    CHANNEL_LAYERS = {
        "default": {
            "BACKEND": "channels_redis.core.RedisChannelLayer",
            "CONFIG": {"hosts": [REDIS_URL], "capacity": 100, "expiry": 30},
        }
    }
else:
    CHANNEL_LAYERS = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}

AUTH_USER_MODEL = "accounts.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "uz"
TIME_ZONE = "Asia/Tashkent"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

# React build: `frontend/dist` (Vite `base: "/static/"`). Serverda Node kerak emas.
FRONTEND_DIST = BASE_DIR.parent / "frontend" / "dist"
STATICFILES_DIRS = [FRONTEND_DIST] if FRONTEND_DIST.exists() else []

MEDIA_URL = "media/"
MEDIA_ROOT = BASE_DIR / "media"
if "test" in sys.argv:  # testlar haqiqiy media papkaga yozmasin
    MEDIA_ROOT = Path(tempfile.mkdtemp(prefix="teamflow-test-media-"))
    PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]  # faqat testni tezlatish uchun

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# Telegram bildirishnomalari: token muhit o'zgaruvchisidan. Bo'sh bo'lsa, Telegram'ga hech narsa yuborilmaydi.
TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
# Bot havolasi (t.me/<username>) — profil va ro'yxatdan o'tishdagi izohda ko'rsatiladi
TELEGRAM_BOT_USERNAME = os.environ.get("TELEGRAM_BOT_USERNAME", "").lstrip("@")
if "test" in sys.argv:
    TELEGRAM_BOT_TOKEN = ""  # testlar tashqi tarmoqqa chiqmasin

# TinyFish web-agent: kalit faqat `backend/.env` yoki muhit o'zgaruvchisida.
# Async task yaratish idempotent emas, shuning uchun servis faqat polling GET so'rovlarini retry qiladi.
TINYFISH_API_KEY = os.environ.get("TINYFISH_API_KEY", "")
TINYFISH_TIMEOUT_SECONDS = int(os.environ.get("TINYFISH_TIMEOUT_SECONDS", "20"))
TINYFISH_HTTP_RETRIES = int(os.environ.get("TINYFISH_HTTP_RETRIES", "2"))

# Yuklanadigan fayllar (apps.core.files)
UPLOAD_ALLOWED_EXTENSIONS = ["docx", "pdf", "png", "jpg", "jpeg"]
UPLOAD_MAX_MB = 20
DATA_UPLOAD_MAX_MEMORY_SIZE = UPLOAD_MAX_MB * 1024 * 1024

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["apps.core.authentication.SessionAuth"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 50,
    "EXCEPTION_HANDLER": "apps.core.api_utils.api_exception_handler",
    # Kirgan foydalanuvchi — user id bo'yicha (IP emas: ofisda hamma bitta NAT IP orqali chiqadi).
    "DEFAULT_THROTTLE_CLASSES": ["apps.core.throttling.UserThrottle"],
    "DEFAULT_THROTTLE_RATES": {
        "user": os.environ.get("DJANGO_THROTTLE_USER", "600/min"),
        # Ro'yxatdan o'tish — IP bo'yicha. Login: har bir login nomiga tor chegara (parol tanlash) va
        # IP bo'yicha faqat xato urinishlar (to'g'ri loginlar sanalmaydi — NAT ortidagi ofis bloklanmaydi).
        "auth": os.environ.get("DJANGO_THROTTLE_AUTH_IP", "60/min"),
        "login": os.environ.get("DJANGO_THROTTLE_LOGIN", "10/min"),
        "login_failures_ip": os.environ.get("DJANGO_THROTTLE_LOGIN_FAILURES_IP", "1000/hour"),
        "ai_web_agent": "5/hour",
    },
}
# Mijoz IP'si: 0 — ulanish manzili (REMOTE_ADDR), soxta X-Forwarded-For'ga ishonilmaydi. Docker'da Nginx
# orqasida 1 (tashqi load balancer ham bo'lsa 2) — throttling haqiqiy IP bo'yicha ishlaydi.
REST_FRAMEWORK["NUM_PROXIES"] = int(os.environ.get("DJANGO_NUM_PROXIES", "0"))
if "test" in sys.argv:
    # Testlar bitta jarayonda minglab so'rov yuboradi — umumiy chegara alohida testlarda tekshiriladi.
    REST_FRAMEWORK["DEFAULT_THROTTLE_CLASSES"] = []

SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"
# Prod HTTPS orqasida (DJANGO_HTTPS=1, standart). Faqat ichki tarmoqdagi HTTP sinov uchun 0 qilinadi.
HTTPS = not DEBUG and os.environ.get("DJANGO_HTTPS", "1") == "1"
if HTTPS:
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    # TLS'ni Nginx tugatadi: Django `X-Forwarded-Proto` ga ishonadi (Nginx uni o'zi qo'yadi).
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SECURE_SSL_REDIRECT = os.environ.get("DJANGO_SECURE_SSL_REDIRECT", "1") == "1"
    SECURE_HSTS_SECONDS = int(os.environ.get("DJANGO_HSTS_SECONDS", "31536000"))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
if not DEBUG:
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_REFERRER_POLICY = "same-origin"
    X_FRAME_OPTIONS = "DENY"

# Loglar konsolga (Docker ularni yig'adi); so'rov logi yozilmaydi — Nginx access log bor.
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {"console": {"class": "logging.StreamHandler"}},
    "root": {"handlers": ["console"], "level": os.environ.get("DJANGO_LOG_LEVEL", "WARNING")},
}
