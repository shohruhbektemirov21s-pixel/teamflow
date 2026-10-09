import os
import sys
import tempfile
from pathlib import Path

from .runtime import cache_config, database_config

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
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
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
    "apps.portfolio",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "apps.core.middleware.PortfolioOnlyUserMiddleware",
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

WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {"default": database_config(os.environ.get("DATABASE_URL", ""), BASE_DIR, debug=DEBUG)}
CACHES = {"default": cache_config(os.environ.get("REDIS_URL", ""), debug=DEBUG)}
SESSION_ENGINE = "django.contrib.sessions.backends.cached_db" if os.environ.get("REDIS_URL") else "django.contrib.sessions.backends.db"
if "test" in sys.argv:
    CACHES = {"default": cache_config("", debug=True)}
    SESSION_ENGINE = "django.contrib.sessions.backends.db"

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
if os.environ.get("DJANGO_MEDIA_ROOT"):
    MEDIA_ROOT = Path(os.environ["DJANGO_MEDIA_ROOT"])
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
# Portfolio videolari (apps.portfolio.files): MP4, WebM, MOV. Nginx `client_max_body_size` bundan katta bo'lsin.
PORTFOLIO_VIDEO_MAX_MB = 100
PORTFOLIO_VIDEOS_PER_ITEM = 5
# Bitta dasturchining barcha videolari uchun umumiy joy — disk to'lib, butun tizim to'xtamasin.
PORTFOLIO_VIDEO_QUOTA_MB = 1024
# Loyiha preview rasmi: avatar kabi Pillow bilan siqiladi (apps.portfolio.services.set_preview_image)
PORTFOLIO_PREVIEW_MAX_MB = 8
PORTFOLIO_PREVIEW_SIZE = 1280

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": ["apps.core.authentication.SessionAuth"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_PAGINATION_CLASS": "apps.core.pagination.BoundedPagination",
    "PAGE_SIZE": 50,
    "EXCEPTION_HANDLER": "apps.core.api_utils.api_exception_handler",
    "DEFAULT_THROTTLE_RATES": {"auth": "20/min", "ai_web_agent": "5/hour", "portfolio_upload": "30/hour"},
}

SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"
SCALE_TEST_MODE = os.environ.get("SCALE_TEST_MODE", "0") == "1"
TELEGRAM_DELIVERY_MODE = os.environ.get("TELEGRAM_DELIVERY_MODE", "thread" if DEBUG else "outbox")
if TELEGRAM_DELIVERY_MODE not in ("thread", "outbox"):
    raise RuntimeError("Unknown TELEGRAM_DELIVERY_MODE")
if not DEBUG:
    SESSION_COOKIE_SECURE = os.environ.get("DJANGO_SECURE_COOKIES", "1") == "1"
    CSRF_COOKIE_SECURE = SESSION_COOKIE_SECURE
    # HTTPS faqat ishlab chiqarishda majburiy. Reverse-proxy TLS ni tugatsa ham Django
    # unga ishonishi uchun deploy muhitida `SECURE_PROXY_SSL_HEADER` ni sozlang.
    SECURE_SSL_REDIRECT = os.environ.get("DJANGO_SECURE_SSL_REDIRECT", "1") == "1"
    SECURE_REDIRECT_EXEMPT = [r"^healthz/"]
    SECURE_HSTS_SECONDS = int(os.environ.get("DJANGO_HSTS_SECONDS", "31536000"))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_REFERRER_POLICY = "same-origin"
    X_FRAME_OPTIONS = "DENY"
    # Only enable behind the trusted reverse proxy; never expose Gunicorn directly.
    if os.environ.get("DJANGO_TRUST_PROXY", "0") == "1":
        SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
