"""Real authenticated HTTP requests against the isolated PostgreSQL stack.

Users make one action every 10-30 seconds. Login bursts require a separate test.
Fixtures contain synthetic sessions; never load real user sessions here.
"""
import itertools
import json
import os
import random
import string
from datetime import date
from pathlib import Path
from urllib.parse import urlparse

import gevent
from locust import HttpUser, between, events, task
from locust.runners import WorkerRunner

fixtures = json.loads(Path(os.environ.get("LOAD_FIXTURES", "/artifacts/users.json")).read_text())
counter = itertools.count()
fixture_workers = int(os.environ.get("LOAD_WORKERS", "1"))
if fixture_workers < 1:
    raise RuntimeError("LOAD_WORKERS must be positive.")


class TeamFlowUser(HttpUser):
    wait_time = between(10, 30)

    def on_start(self):
        host = urlparse(self.host)
        if host.hostname not in ("proxy", "localhost", "127.0.0.1"):
            raise RuntimeError("Load tests are restricted to the isolated local stack.")
        worker_index = self.environment.runner.worker_index
        if not 0 <= worker_index < fixture_workers:
            raise RuntimeError("Worker count does not match LOAD_WORKERS; refusing duplicate sessions.")
        index = next(counter) * fixture_workers + worker_index
        if index >= len(fixtures):
            raise RuntimeError("Insufficient unique session fixtures.")
        self.user = fixtures[index]
        token = "".join(random.choices(string.ascii_letters + string.digits, k=32))
        self.client.cookies.set("sessionid", self.user["session"])
        self.client.cookies.set("csrftoken", token)
        self.client.headers.update({"X-CSRFToken": token, "Referer": self.host + "/", "Origin": self.host})
        self.chat_cursor = None
        gevent.sleep(random.uniform(0, 30))

    @task(40)
    def unread(self):
        self.client.get("/api/notifications/unread_count/", name="notifications/unread", timeout=20)

    @task(20)
    def dashboard(self):
        self.client.get("/api/dashboard/", name=f"dashboard/{self.user['role']}", timeout=20)

    @task(15)
    def listing(self):
        path = "/api/orders/" if self.user["role"] == "department" else "/api/tasks/?mine=1" if self.user["role"] == "developer" else "/api/tasks/"
        self.client.get(path, name=f"list/{self.user['role']}", timeout=20)

    @task(10)
    def detail_or_people(self):
        if self.user["role"] in ("boss", "pm"):
            self.client.get("/api/people/?paginated=1", name="people/page", timeout=20)
        elif self.user["task"]:
            self.client.get(f"/api/tasks/{self.user['task']}/", name="task/detail", timeout=20)
        else:
            self.client.get("/api/orders/", name="orders/page", timeout=20)

    @task(10)
    def chat(self):
        if not self.user["partner"]:
            return self.unread()
        suffix = f"&after={self.chat_cursor}" if self.chat_cursor is not None else ""
        with self.client.get(f"/api/chat/messages/?partner={self.user['partner']}{suffix}", name="chat/poll", timeout=20, catch_response=True) as response:
            if response.status_code == 200:
                messages = response.json()
                if messages:
                    self.chat_cursor = max(message["id"] for message in messages)

    @task(5)
    def write_work(self):
        if self.user["role"] != "developer" or not self.user["task"]:
            return self.unread()
        self.client.post(f"/api/tasks/{self.user['task']}/worklogs/", name="worklog/write",
                         json={"work_date": date.today().isoformat(), "hours": "0.25", "note": "Synthetic load-test work"}, timeout=20)


@events.quitting.add_listener
def enforce_thresholds(environment, **kwargs):
    # Workers flush/reset their local stats during shutdown; qualify the master.
    if isinstance(environment.runner, WorkerRunner):
        return
    stats = environment.stats.total
    max_p95 = float(os.environ.get("LOAD_MAX_P95_MS", "500"))
    if stats.num_requests == 0 or stats.fail_ratio >= 0.01 or stats.get_response_time_percentile(0.95) > max_p95:
        environment.process_exit_code = 1
