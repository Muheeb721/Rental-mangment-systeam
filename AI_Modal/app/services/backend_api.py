"""Small client for the RMS website backend (Node/Express on :5000).

Used for the places dataset, area stats and travel estimates so the chatbot quotes the
same numbers as the website. Every call has a short timeout; a failing route is
skipped for a while ("circuit breaker") and callers fall back to local estimates.
"""
from __future__ import annotations

import logging
import threading
import time
from typing import Any

import httpx

from app import config

log = logging.getLogger("rms.backend")

_down_until: dict[str, float] = {}
_cache: dict[str, tuple[float, Any]] = {}
_lock = threading.Lock()
RETRY_AFTER_FAIL = 60.0
CACHE_SECONDS = 300.0
_client = httpx.Client(timeout=config.BACKEND_TIMEOUT_SECONDS)


def _route_key(path: str) -> str:
    parts = path.split("?")[0].strip("/").split("/")
    return "/".join(parts[:2])                       # "api/travel", "api/areas", ...


def get_json(path: str, params: dict | None = None, timeout: float | None = None,
             cache: bool = True) -> Any | None:
    """GET {BACKEND_URL}{path}; returns parsed JSON (unwrapping {success,data}) or None."""
    if not config.USE_BACKEND_API or not config.BACKEND_URL:
        return None
    route = _route_key(path)
    now = time.time()
    if _down_until.get(route, 0) > now:
        return None
    key = path + "?" + "&".join(f"{k}={v}" for k, v in sorted((params or {}).items()))
    with _lock:
        hit = _cache.get(key)
        if cache and hit and now - hit[0] < CACHE_SECONDS:
            return hit[1]
    try:
        resp = _client.get(config.BACKEND_URL + path, params=params,
                           timeout=timeout or config.BACKEND_TIMEOUT_SECONDS)
    except httpx.HTTPError as error:
        _down_until[route] = now + RETRY_AFTER_FAIL
        log.info("backend %s unavailable (%s)", route, error.__class__.__name__)
        return None
    if resp.status_code == 404 and "not found" in resp.text.lower() and "route" in resp.text.lower():
        _down_until[route] = now + RETRY_AFTER_FAIL      # API not deployed yet
        return None
    if resp.status_code >= 400:
        return None
    try:
        data = resp.json()
    except ValueError:
        return None
    if isinstance(data, dict) and data.get("success") is False:
        return None
    if isinstance(data, dict) and "data" in data and len(data) <= 4 and not any(
            k in data for k in ("distanceKm", "modes", "places", "areas")):
        data = data["data"]
    with _lock:
        if cache:
            if len(_cache) > 3000:
                _cache.clear()
            _cache[key] = (now, data)
    return data


def reset() -> None:
    _down_until.clear()
    _cache.clear()
