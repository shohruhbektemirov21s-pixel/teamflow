from .models import ActivityLog


def log(actor, verb, message, target=None):
    """Umumiy tarixga yozuv. Servislar ichidan chaqiriladi."""
    return ActivityLog.objects.create(actor=actor, verb=verb, message=message[:255], target=target)
