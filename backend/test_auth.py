import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.backends import ModelBackend
u = get_user_model().objects.get(username='oddiy')
print("user exists:", u)
print("is_active:", u.is_active)
print("check_password:", u.check_password('Demo-parol-2026'))
mb = ModelBackend()
print("can authenticate:", mb.user_can_authenticate(u))
print("authenticate returns:", authenticate(username='oddiy', password='Demo-parol-2026'))
from rest_framework.test import APIRequestFactory
req = APIRequestFactory().post('/api/auth/login/', {'username': 'oddiy', 'password': 'Demo-parol-2026'}, format='json')
from django.contrib.sessions.middleware import SessionMiddleware
middleware = SessionMiddleware(lambda request: None)
middleware.process_request(req)
from apps.accounts.api import login_view
print("login_view returns:", login_view(req))
