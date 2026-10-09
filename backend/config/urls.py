from django.conf import settings
from django.contrib import admin
from django.http import FileResponse, Http404
from django.urls import include, path, re_path
from rest_framework.routers import DefaultRouter

from apps.accounts import api as accounts
from apps.accounts.throttles import throttled_admin_login
from apps.notifications.api import NotificationViewSet
from apps.orders.api import OrderViewSet
from apps.panel import api as panel
from apps.portfolio import api as portfolio
from apps.projects.api import ProjectViewSet
from apps.suggestions.api import SuggestionViewSet
from apps.tasks.api import TaskViewSet, project_setup
from apps.chat.api import ChatViewSet
from apps.ai.api import WebAgentView
from apps.core.health import live, ready
from apps.panel.calendar import calendar_summary

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
    path("auth/avatar/", accounts.avatar),
    path("avatars/<int:pk>/", accounts.avatar_image),
    path("specialties/", accounts.specialties),
    path("developers/", accounts.developers),
    path("meta/", panel.meta),
    path("dashboard/", panel.dashboard),
    path("calendar/", calendar_summary),
    path("people/", panel.people),
    path("people/<int:pk>/business-trip/", accounts.business_trip),
    path("people/<int:pk>/responsibilities/", accounts.responsibilities),
    path("search/", panel.search),
    path("workdone/", panel.workdone),
    path("people/<int:pk>/", panel.person_profile),
    path("comments/", panel.comments),
    path("history/", panel.history),
    path("files/<str:kind>/<int:pk>/", panel.file_download),
    path("projects/setup/", project_setup),  # router'dagi projects/<pk>/ dan oldin turishi shart
    path("portfolio/", portfolio.developer_list),
    path("portfolio/<int:pk>/", portfolio.developer_detail),
    path("portfolio/<int:pk>/follow/", portfolio.follow),
    path("portfolio/items/", portfolio.item_create),
    path("portfolio/items/<int:pk>/", portfolio.item),
    path("portfolio/items/<int:pk>/reviews/", portfolio.reviews),
    path("portfolio/items/<int:pk>/videos/", portfolio.video_upload),
    path("portfolio/items/<int:pk>/videos/<int:video_pk>/", portfolio.video_delete),
    path("portfolio/videos/<int:pk>/", portfolio.video_file),
    path("ai/web-agent/", WebAgentView.as_view()),
    path("ai/web-agent/<int:pk>/", WebAgentView.as_view()),
    path("", include(router.urls)),
]


def spa(request):
    """React ilovasi (build qilingan `frontend/dist/index.html`). Media fayllar ochiq berilmaydi —
    faqat `/api/files/...` orqali ruxsat tekshiruvi bilan."""
    index = settings.FRONTEND_DIST / "index.html"
    if not index.exists():
        raise Http404("Frontend build qilinmagan: frontend papkasida `npm run build` ni ishga tushiring.")
    response = FileResponse(open(index, "rb"), content_type="text/html")
    response["Content-Security-Policy"] = settings.CONTENT_SECURITY_POLICY
    return response


urlpatterns = [
    path("healthz/live/", live),
    path("healthz/ready/", ready),
    path("admin/login/", throttled_admin_login),  # admin.site.urls dan oldin turishi shart
    path("admin/", admin.site.urls),
    path("api/", include(api)),
    re_path(r"^(?!api/|admin/|static/).*$", spa),
]
