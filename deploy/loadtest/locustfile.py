"""TeamFlow yuk testi: har bir virtual foydalanuvchi — ochiq tabli dasturchi.

Login → WebSocket (/ws/events/) ochiq turadi → har 10–30 soniyada bitta amal (bosh panel, vazifalar,
vazifa oynasi, bildirishnomalar, chat, qidiruv). Ishga tushirish: deploy/loadtest/README.md
"""
import os
import random
import time

import gevent
import websocket
from locust import HttpUser, between, events, task
from locust.exception import StopUser

PASSWORD = os.environ.get("LT_PASSWORD", "Loadtest-2026")
USERS = int(os.environ.get("LT_USERS", "10000"))


def _fire(kind, name, started, exc=None, length=0):
    events.request.fire(request_type=kind, name=name, response_time=(time.perf_counter() - started) * 1000,
                        response_length=length, exception=exc, context={})


class Developer(HttpUser):
    wait_time = between(10, 30)

    def on_start(self):
        self.ws = None
        self.running = True
        index = random.randrange(USERS)  # --processes: har jarayon mustaqil — tasodifiy tanlov
        self.client.get("/api/auth/csrf/", name="/api/auth/csrf/")
        with self.client.post("/api/auth/login/", json={"username": f"lt_dev_{index:05d}", "password": PASSWORD},
                              headers=self._csrf(), name="/api/auth/login/", catch_response=True) as r:
            if r.status_code != 200:
                r.failure(f"login {r.status_code}")
                self.running = False
                raise StopUser()  # sessiyasiz so'rovlar (401) statistikani buzmasin
        # Sahifa ochilishi
        for url in ("/api/auth/me/", "/api/meta/", "/api/dashboard/", "/api/notifications/unread_count/"):
            self.client.get(url)
        self.task_ids = [t["id"] for t in self.client.get("/api/tasks/?bucket=active&period=week",
                                                           name="/api/tasks/?bucket").json().get("results", [])]
        self.partners = [p["id"] for p in self.client.get("/api/chat/people/?q=Dev1", name="/api/chat/people/").json()]
        gevent.spawn(self._websocket)

    def on_stop(self):
        self.running = False
        if self.ws:
            self.ws.close()

    def _csrf(self):
        return {"X-CSRFToken": self.client.cookies.get("csrftoken", "")}

    def _websocket(self):
        """Ochiq tab: hodisalarni kutadi; uzilsa tasodifiy kechikish bilan qayta ulanadi (frontend kabi)."""
        url = self.host.replace("http", "ws", 1) + "/ws/events/"
        cookie = "; ".join(f"{k}={v}" for k, v in self.client.cookies.items())
        while self.running:
            started = time.perf_counter()
            try:
                self.ws = websocket.create_connection(url, cookie=cookie, origin=self.host, timeout=30)
                _fire("WS", "connect", started)
                self.ws.settimeout(None)
                while self.running:
                    message = self.ws.recv()
                    # Hodisa soni hisoblanadi; javob vaqti emas (hodisalar orasidagi kutish statistikani buzmasin)
                    _fire("WS", "event", time.perf_counter(), length=len(message))
            except Exception as exc:  # noqa: BLE001 — har qanday uzilish statistikaga yoziladi
                if not self.running:
                    return
                _fire("WS", "disconnect", started, exc=exc)
                gevent.sleep(random.uniform(1, 10))

    @task(3)
    def dashboard(self):
        self.client.get("/api/dashboard/")
        self.client.get("/api/tasks/?bucket=active&period=week", name="/api/tasks/?bucket")

    @task(3)
    def task_list(self):  # dasturchida ~5 vazifa — bitta sahifa
        self.client.get("/api/tasks/", name="/api/tasks/")

    @task(2)
    def task_detail(self):
        if self.task_ids:
            self.client.get(f"/api/tasks/{random.choice(self.task_ids)}/", name="/api/tasks/[id]/")

    @task(2)
    def notifications(self):
        self.client.get("/api/notifications/", name="/api/notifications/")

    @task(1)
    def chat(self):
        self.client.get("/api/chat/conversations/")
        if self.partners:
            partner = random.choice(self.partners)
            self.client.post("/api/chat/send/", json={"partner": partner, "text": "Yuk testi"},
                             headers=self._csrf(), name="/api/chat/send/")
            self.client.get(f"/api/chat/messages/?partner={partner}", name="/api/chat/messages/")

    @task(1)
    def search(self):
        self.client.get(f"/api/search/?q={random.randint(800000, 800049)}", name="/api/search/")
