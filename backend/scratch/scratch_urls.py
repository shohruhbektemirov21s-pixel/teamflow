import os

path = "backend/config/urls.py"
with open(path, "r", encoding="utf-8") as f:
    text = f.read()

text = text.replace(
    'router.register("suggestions", SuggestionViewSet, basename="suggestion")',
    'router.register("suggestions", SuggestionViewSet, basename="suggestion")\nrouter.register("chat", ChatViewSet, basename="chat")'
)

text = text.replace(
    'from apps.tasks.api import TaskViewSet',
    'from apps.tasks.api import TaskViewSet\nfrom apps.chat.api import ChatViewSet'
)

with open(path, "w", encoding="utf-8") as f:
    f.write(text)

print("Updated URLs")
