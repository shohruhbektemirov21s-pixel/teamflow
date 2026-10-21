"""Portfolio ruxsatlari — BITTA joyda. Ko'rish: tizimga kirgan hamma. O'zgartirish: faqat egasi.
Baholash va kuzatish: rolga ega boshqa foydalanuvchilar (o'zini baholay/kuzata olmaydi)."""
from apps.accounts.models import Role, User


def portfolio_owners():
    """Portfoliosi bor foydalanuvchilar — faol dasturchilar."""
    return User.objects.filter(is_active=True, role=Role.DEVELOPER)


def can_edit_item(user, item):
    return item.owner_id == user.pk


def can_review_item(user, item):
    return bool(user.is_authenticated and user.role) and item.owner_id != user.pk


def can_follow(user, developer):
    return bool(user.is_authenticated and user.role) and developer.pk != user.pk
