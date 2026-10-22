"""Environment-driven storage configuration; local SQLite stays separate from production."""
import os
from urllib.parse import parse_qs, unquote, urlparse

from django.core.exceptions import ImproperlyConfigured


def env_flag(name, default=False):
    """Faqat aniq `1` yoqadi; o'zgaruvchi yo'q bo'lsa `default` (xavfsiz tomon: o'chiq)."""
    value = os.environ.get(name)
    return default if value is None else value == "1"


def database_config(url, base_dir, *, debug):
    if not url:
        if not debug:
            raise ImproperlyConfigured("Production requires a PostgreSQL DATABASE_URL.")
        return {"ENGINE": "django.db.backends.sqlite3", "NAME": base_dir / "db.sqlite3",
                "OPTIONS": {"timeout": 20}}
    parsed = urlparse(url)
    if parsed.scheme not in ("postgres", "postgresql") or not parsed.hostname or not parsed.path.strip("/"):
        raise ImproperlyConfigured("DATABASE_URL must identify a PostgreSQL database.")
    statement_timeout = int(os.environ.get("DB_STATEMENT_TIMEOUT_MS", "15000"))
    lock_timeout = int(os.environ.get("DB_LOCK_TIMEOUT_MS", "5000"))
    if statement_timeout <= 0 or lock_timeout <= 0:
        raise ImproperlyConfigured("Database timeouts must be positive milliseconds.")
    options = {"connect_timeout": 5,
               "options": f"-c statement_timeout={statement_timeout} -c lock_timeout={lock_timeout}"}
    sslmode = parse_qs(parsed.query).get("sslmode", [None])[0]
    if sslmode:
        options["sslmode"] = sslmode
    return {"ENGINE": "django.db.backends.postgresql", "NAME": unquote(parsed.path[1:]),
            "USER": unquote(parsed.username or ""), "PASSWORD": unquote(parsed.password or ""),
            "HOST": parsed.hostname, "PORT": parsed.port or 5432,
            "CONN_MAX_AGE": int(os.environ.get("DB_CONN_MAX_AGE", "60")),
            "CONN_HEALTH_CHECKS": True, "OPTIONS": options}


def cache_config(url, *, debug):
    if not url:
        if not debug:
            raise ImproperlyConfigured("Production requires a shared REDIS_URL.")
        return {"BACKEND": "django.core.cache.backends.locmem.LocMemCache", "LOCATION": "teamflow-local"}
    if urlparse(url).scheme not in ("redis", "rediss"):
        raise ImproperlyConfigured("REDIS_URL must use redis:// or rediss://.")
    return {"BACKEND": "django.core.cache.backends.redis.RedisCache", "LOCATION": url,
            "KEY_PREFIX": "teamflow", "OPTIONS": {"socket_connect_timeout": 2, "socket_timeout": 2}}
