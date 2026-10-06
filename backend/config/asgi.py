import os

from django.core.asgi import get_asgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django_asgi_app = get_asgi_application()  # modellar import qilinishidan oldin Django sozlansin

from channels.auth import AuthMiddlewareStack  # noqa: E402
from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: E402
from channels.security.websocket import AllowedHostsOriginValidator  # noqa: E402
from django.urls import path  # noqa: E402

from apps.core.consumers import EventsConsumer  # noqa: E402

# Prod: HTTP — gunicorn (WSGI), WebSocket — daphne (shu fayl). Dev `runserver` ikkalasini shu yerdan beradi.
# Origin tekshiruvi: boshqa saytdan ochilgan WebSocket (sessiya cookie bilan) rad etiladi.
application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": AllowedHostsOriginValidator(
            AuthMiddlewareStack(URLRouter([path("ws/events/", EventsConsumer.as_asgi())]))
        ),
    }
)
