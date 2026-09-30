from django.conf import settings
from django.contrib import admin
from django.http import FileResponse, Http404
from django.urls import include, path, re_path
from rest_framework.routers import DefaultRouter

from apps.accounts import api as accounts
from apps.notifications.api import NotificationViewSet
from apps.orders.api import OrderViewSet
from apps.panel import api as panel
from apps.projects.api import ProjectViewSet
from apps.suggestions.api import SuggestionViewSet
from apps.tasks.api import TaskViewSet, project_setup
from apps.chat.api import ChatViewSet

admin.site.site_header = "TeamFlow — Boshqaruv paneli"
admin.site.site_title = "TeamFlow"
admin.site.index_title = "Boshqaruv"

router = DefaultRouter(trailing_slash=True)
router.register("orders", OrderViewSet, basename="order")
router.register("projects", ProjectViewSet, basename="project")
router.register("tasks", TaskViewSet, basename="task")
router.register("notifications", NotificationViewSet, basename="notification")
router.register("suggestions", SuggestionViewSet, basename="suggestion")
router.register("chat", ChatViewSet, basename="chat")

api = [
    path("auth/csrf/", accounts.csrf),
    path("auth/register/", accounts.register),
    path("auth/login/", accounts.login_view),
    path("auth/logout/", accounts.logout_view),
    path("auth/me/", accounts.me),
    path("auth/profile/", accounts.profile),
    path("auth/password/", accounts.change_password),
    path("specialties/", accounts.specialties),
    path("developers/", accounts.developers),
    path("meta/", panel.meta),
    path("dashboard/", panel.dashboard),
    path("people/", panel.people),
    path("search/", panel.search),
    path("workdone/", panel.workdone),
    path("people/<int:pk>/", panel.person_profile),
    path("comments/", panel.comments),
    path("history/", panel.history),
    path("files/<str:kind>/<int:pk>/", panel.file_download),
    path("projects/setup/", project_setup),  # router'dagi projects/<pk>/ dan oldin turishi shart
    path("", include(router.urls)),
]


def spa(request):
    """React ilovasi (build qilingan `frontend/dist/index.html`). Media fayllar ochiq berilmaydi —
    faqat `/api/files/...` orqali ruxsat tekshiruvi bilan."""
    index = settings.FRONTEND_DIST / "index.html"
    if not index.exists():
        raise Http404("Frontend build qilinmagan: frontend papkasida `npm run build` ni ishga tushiring.")
    return FileResponse(open(index, "rb"), content_type="text/html")


urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include(api)),
    re_path(r"^(?!api/|admin/|static/).*$", spa),
]
