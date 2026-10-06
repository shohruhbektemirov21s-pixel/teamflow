"""Executed through manage.py shell, only against the isolated scale database."""
import json
import secrets
from pathlib import Path

from django.conf import settings
from django.db import connection
from apps.accounts.models import Role, User

if not settings.SCALE_TEST_MODE or connection.vendor != "postgresql" or connection.settings_dict["NAME"] != "teamflow_scale":
    raise RuntimeError("Browser credentials require the isolated scale database.")
password = secrets.token_urlsafe(30)
user = User(username="scale_browser_login", first_name="SyntheticBrowser", last_name="Test",
            role=Role.DEPARTMENT, department_name="Synthetic browser department", is_active=True)
user.set_password(password)
user.save(force_insert=True)
Path("/artifacts/browser-login.json").write_text(json.dumps({"username": user.username, "password": password}))
print("Created one isolated browser-test account. Credentials were not printed.")
