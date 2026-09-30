import threading
import requests
from django.conf import settings

with open('backend/apps/notifications/services.py', 'r', encoding='utf-8') as f:
    text = f.read()

import_reqs = 'import threading\nimport requests\nfrom django.conf import settings\n'
if 'import threading' not in text:
    text = import_reqs + text

def_thread = '''
def send_telegram_message(chat_id, message):
    token = getattr(settings, "TELEGRAM_BOT_TOKEN", None)
    if not token or token == "dummy_token_for_testing":
        return
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    try:
        requests.post(url, json={"chat_id": chat_id, "text": message})
    except:
        pass
'''
if 'def send_telegram_message' not in text:
    text += def_thread

if 'threading.Thread' not in text:
    text = text.replace('Notification.objects.bulk_create(items)', 'Notification.objects.bulk_create(items)\n    for item in items:\n        if getattr(item.recipient, "telegram_chat_id", None):\n            threading.Thread(target=send_telegram_message, args=(item.recipient.telegram_chat_id, item.message)).start()')

with open('backend/apps/notifications/services.py', 'w', encoding='utf-8') as f:
    f.write(text)
