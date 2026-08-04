"""Loyihalar: kim nimani ko'radi — BITTA joyda."""
from .models import Project


def visible_projects(user):
    """PM/Boshliq — hammasi. Dasturchi — a'zo bo'lganlari. Boshqarma — hech narsa (buyurtma orqali kuzatadi)."""
    qs = Project.objects.select_related("created_by", "order")
    if user.is_manager:
        return qs
    if user.is_developer:
        return qs.filter(memberships__developer=user).distinct()
    return qs.none()


def can_view_project(user, project):
    if user.is_manager:
        return True
    return user.is_developer and project.memberships.filter(developer=user).exists()
