"""TinyFish REST API bilan bitta, xavfsiz integratsiya nuqtasi."""
from __future__ import annotations

import ipaddress
import logging
import socket
import time
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlsplit, urlunsplit

import requests
from django.conf import settings

logger = logging.getLogger(__name__)

AGENT_BASE_URL = "https://agent.tinyfish.ai"
SEARCH_URL = "https://api.search.tinyfish.ai"
FETCH_URL = "https://api.fetch.tinyfish.ai"

# TinyFish qo'llab-quvvatlaydigan JSON Schema kichik to'plamidan foydalaniladi.
STRUCTURED_RESULT_SCHEMA = {
    "type": "object",
    "properties": {
        "summary": {"type": "string"},
        "results": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "url": {"type": "string"},
                    "description": {"type": "string", "nullable": True},
                },
                "required": ["title", "url"],
            },
            "maxItems": 20,
        },
        "citations": {"type": "array", "items": {"type": "string"}, "maxItems": 20},
    },
    "required": ["summary", "results", "citations"],
}


class TinyFishError(Exception):
    status_code = 503
    user_message = "Web agent xizmati hozir mavjud emas. Keyinroq qayta urinib ko'ring."

    def __init__(self, reason: str = ""):
        super().__init__(reason)
        self.reason = reason


class TinyFishUnavailable(TinyFishError):
    """Tarmoq, timeout yoki noto'g'ri konfiguratsiya sababli xizmat ishlamayapti."""


class TinyFishRemoteError(TinyFishError):
    status_code = 502
    user_message = "Web agent vazifani qabul qila olmadi. Keyinroq qayta urinib ko'ring."


@dataclass(frozen=True)
class ProviderTask:
    status: str
    result: dict[str, Any] | None
    error: str | None


def validate_public_url(value: str) -> str:
    """URL faqat umumiy internet manziliga tegishli ekanini tekshiradi.

    TinyFish ichki manzillarga so'rov yuborishi uchun ishlatilmasligi kerak. DNS javobidagi
    bitta private IP ham URL'ni rad etadi; shu bilan DNS rebinding xavfi ham kamayadi.
    """
    try:
        parsed = urlsplit(value.strip())
        port = parsed.port
    except (TypeError, ValueError) as exc:
        raise ValueError("URL noto'g'ri.") from exc

    hostname = (parsed.hostname or "").rstrip(".").lower()
    if parsed.scheme not in {"http", "https"} or not hostname or parsed.username or parsed.password:
        raise ValueError("Faqat ochiq http yoki https URL ishlating.")
    if port is not None and not (1 <= port <= 65535):
        raise ValueError("URL porti noto'g'ri.")
    if hostname == "localhost" or hostname.endswith(".localhost") or hostname.endswith(".local"):
        raise ValueError("Ichki URL'larga ruxsat berilmaydi.")

    try:
        literal = ipaddress.ip_address(hostname)
        addresses = [literal]
    except ValueError:
        try:
            addresses = [ipaddress.ip_address(item[4][0]) for item in socket.getaddrinfo(hostname, None)]
        except socket.gaierror as exc:
            raise ValueError("URL manzilini tekshirib bo'lmadi.") from exc

    if not addresses or any(not address.is_global for address in addresses):
        raise ValueError("Ichki yoki private URL'larga ruxsat berilmaydi.")

    netloc = hostname if port is None else f"{hostname}:{port}"
    return urlunsplit((parsed.scheme, netloc, parsed.path or "/", parsed.query, ""))


class TinyFishService:
    """TinyFish so'rovlari uchun timeout, xavfsiz xato va ehtiyotkor retry siyosati."""

    def __init__(self):
        self.api_key = getattr(settings, "TINYFISH_API_KEY", "")
        self.timeout = int(getattr(settings, "TINYFISH_TIMEOUT_SECONDS", 20))
        self.retries = int(getattr(settings, "TINYFISH_HTTP_RETRIES", 2))

    @property
    def headers(self):
        if not self.api_key:
            raise TinyFishUnavailable("TINYFISH_API_KEY o'rnatilmagan")
        return {"X-API-Key": self.api_key, "Content-Type": "application/json"}

    def _request(self, method: str, url: str, *, payload=None, params=None, retry: bool = True):
        """Idempotent o'qish so'rovlari vaqtinchalik xatolarda qayta uriniladi.

        Async ishni boshlash POST'i qayta yuborilmaydi: TinyFish bu amallar idempotent
        emasligini bildiradi va timeoutdan so'ng takrorlash ikki marta ish yaratishi mumkin.
        """
        attempts = self.retries + 1 if retry else 1
        last_error: Exception | None = None
        request_fn = getattr(requests, method.lower())
        for attempt in range(attempts):
            try:
                response = request_fn(url, headers=self.headers, json=payload, params=params, timeout=self.timeout)
                status_code = getattr(response, "status_code", None)
                if isinstance(status_code, int) and (status_code >= 500 or status_code == 429):
                    response.raise_for_status()
                response.raise_for_status()
                try:
                    return response.json()
                except ValueError as exc:
                    raise TinyFishRemoteError("TinyFish JSON javobi noto'g'ri") from exc
            except requests.HTTPError as exc:
                status_code = getattr(getattr(exc, "response", None), "status_code", None)
                if retry and attempt + 1 < attempts and status_code in {429, 500, 502, 503, 504}:
                    last_error = exc
                else:
                    logger.warning("TinyFish HTTP xatosi: status=%s", status_code)
                    raise TinyFishRemoteError(f"HTTP {status_code or 'error'}") from exc
            except requests.RequestException as exc:
                last_error = exc
                if not retry or attempt + 1 >= attempts:
                    logger.warning("TinyFish tarmoq xatosi: %s", type(exc).__name__)
                    raise TinyFishUnavailable(type(exc).__name__) from exc
            if last_error is not None:
                time.sleep(0.25 * (2 ** attempt))
        raise TinyFishUnavailable(type(last_error).__name__ if last_error else "noma'lum xato")

    def search(self, query: str) -> dict[str, Any]:
        """Ranklangan web qidiruv natijalarini oladi."""
        return self._request("GET", SEARCH_URL, params={"query": query})

    def open_page(self, url: str) -> dict[str, Any]:
        """Ochiq sahifa matnini Fetch API orqali oladi."""
        public_url = validate_public_url(url)
        return self._request("POST", FETCH_URL, payload={"urls": [public_url]}, retry=False)

    def navigate(self, url: str, task: str) -> str:
        """TinyFish Agent'ga URL ichida navigatsiya va structured extraction topshiradi."""
        public_url = validate_public_url(url)
        payload = {
            "url": public_url,
            "goal": task,
            "output_schema": STRUCTURED_RESULT_SCHEMA,
            "agent_config": {"max_duration_seconds": self.timeout * 6},
        }
        data = self._request("POST", f"{AGENT_BASE_URL}/v1/automation/run-async", payload=payload, retry=False)
        return self._run_id(data, "run_id")

    def get_structured_json(self, url: str, task: str) -> str:
        """Nomlangan qulay metod: `navigate` natijasi structured JSON run bo'ladi."""
        return self.navigate(url, task)

    def research(self, query: str) -> str:
        """URL bo'lmagan savol uchun manbali asinxron tadqiqot boshlaydi."""
        data = self._request(
            "POST",
            f"{AGENT_BASE_URL}/v1/automation/run-research-async",
            payload={"query": query, "mode": "standard"},
            retry=False,
        )
        return self._run_id(data, "research_run_id")

    def get_task_status(self, provider_kind: str, provider_run_id: str) -> ProviderTask:
        """TinyFish holatini frontend uchun pending/running/completed/failed ko'rinishiga o'tkazadi."""
        if provider_kind == "research":
            data = self._request("GET", f"{AGENT_BASE_URL}/v1/research-run/{provider_run_id}")
            return self._normalize_research(data)
        data = self._request("GET", f"{AGENT_BASE_URL}/v1/runs/{provider_run_id}")
        return self._normalize_automation(data)

    @staticmethod
    def _run_id(data: dict[str, Any], field: str) -> str:
        if data.get("error"):
            raise TinyFishRemoteError("TinyFish run yaratmadi")
        run_id = data.get(field)
        if not isinstance(run_id, str) or not run_id:
            raise TinyFishRemoteError("TinyFish run ID qaytarmadi")
        return run_id

    @staticmethod
    def _status(value: object) -> str:
        status = str(value or "").upper()
        if status in {"PENDING", "QUEUED"}:
            return "pending"
        if status == "RUNNING":
            return "running"
        if status == "COMPLETED":
            return "completed"
        return "failed"

    def _normalize_automation(self, data: dict[str, Any]) -> ProviderTask:
        raw_result = data.get("result")
        normalized = self._normalize_result(raw_result)
        status = self._status(data.get("status"))
        if status == "completed" and isinstance(raw_result, dict) and raw_result.get("status") == "failure":
            return ProviderTask("failed", normalized, self._safe_error(raw_result.get("reason") or raw_result.get("error")))
        return ProviderTask(status, normalized, self._safe_error((data.get("error") or {}).get("message") if isinstance(data.get("error"), dict) else data.get("error")))

    def _normalize_research(self, data: dict[str, Any]) -> ProviderTask:
        deep = data.get("deep_result") if isinstance(data.get("deep_result"), dict) else {}
        quick = data.get("quick_result") if isinstance(data.get("quick_result"), dict) else {}
        source = deep or quick
        result = {
            "summary": source.get("result") or source.get("answer") or data.get("quick_result_summary") or "",
            "items": [],
            "citations": self._citations(source.get("citations")),
            "data": source or None,
        }
        error = data.get("error")
        if isinstance(error, dict):
            error = error.get("message") or error.get("code")
        return ProviderTask(self._status(data.get("status")), result, self._safe_error(error))

    def _normalize_result(self, raw_result: Any) -> dict[str, Any] | None:
        if raw_result is None:
            return None
        if not isinstance(raw_result, dict):
            return {"summary": str(raw_result), "items": [], "citations": [], "data": raw_result}
        items = raw_result.get("results") if isinstance(raw_result.get("results"), list) else []
        summary = raw_result.get("summary") or raw_result.get("result") or ""
        return {"summary": str(summary), "items": items, "citations": self._citations(raw_result.get("citations")), "data": raw_result}

    @staticmethod
    def _citations(value: Any) -> list[dict[str, str]]:
        if not isinstance(value, list):
            return []
        normalized = []
        for item in value[:20]:
            if isinstance(item, str):
                normalized.append({"title": item, "url": item})
            elif isinstance(item, dict) and isinstance(item.get("url"), str):
                normalized.append({"title": str(item.get("title") or item["url"]), "url": item["url"]})
        return normalized

    @staticmethod
    def _safe_error(value: Any) -> str | None:
        if not value:
            return None
        return str(value).replace("\n", " ")[:500]
