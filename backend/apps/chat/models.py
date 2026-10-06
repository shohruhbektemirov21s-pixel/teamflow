from django.conf import settings
from django.db import models

class ChatMessage(models.Model):
    author = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="chat_sent")
    recipient = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="chat_received")
    text = models.TextField()
    is_read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["author", "recipient", "-id"], name="chat_partner_cursor_idx"),
            models.Index(fields=["recipient", "is_read", "author"], name="chat_unread_author_idx"),
            models.Index(fields=["author", "recipient", "-created_at"]),
            models.Index(fields=["recipient", "author", "-created_at"], name="chat_recipient_partner_idx"),
        ]
