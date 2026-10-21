"""Environment-driven storage configuration; local SQLite stays separate from production."""
from urllib.parse import parse_qs, unquote, urlparse

from django.core.exceptions import ImproperlyConfigured


def database_config(url, base_dir, *, debug):
    if not url:
        if not debug:
            raise ImproperlyConfigured("Production requires a PostgreSQL DATABASE_URL.")
        return {"ENGINE": "django.db.backends.sqlite3", "NAME": base_dir / "db.sqlite3",
                "OPTIONS": {"timeout": 20}}
    parsed = urlparse(url)
    if parsed.scheme not in ("postgres", "postgresql") or not parsed.hostname or not parsed.path.strip("/"):
        raise ImproperlyConfigured("DATABASE_URL must identify a PostgreSQL database.")
    options = {"connect_timeout": 5, "options": "-c statement_timeout=15000 -c lock_timeout=5000"}
    sslmode = parse_qs(parsed.query).get("sslmode", [None])[0]
    if sslmode:
        options["sslmode"] = sslmode
    return {"ENGINE": "django.db.backends.postgresql", "NAME": unquote(parsed.path[1:]),
            "USER": unquote(parsed.username or ""), "PASSWORD": unquote(parsed.password or ""),
            "HOST": parsed.hostname, "PORT": parsed.port or 5432,
            "CONN_MAX_AGE": 60, "CONN_HEALTH_CHECKS": True, "OPTIONS": options}


def cache_config(url, *, debug):
    if not url:
        if not debug:
            raise ImproperlyConfigured("Production requires a shared REDIS_URL.")
        return {"BACKEND": "django.core.cache.backends.locmem.LocMemCache", "LOCATION": "teamflow-local"}
    if urlparse(url).scheme not in ("redis", "rediss"):
        raise ImproperlyConfigured("REDIS_URL must use redis:// or rediss://.")
    return {"BACKEND": "django.core.cache.backends.redis.RedisCache", "LOCATION": url,
            "KEY_PREFIX": "teamflow", "OPTIONS": {"socket_connect_timeout": 2, "socket_timeout": 2}}
