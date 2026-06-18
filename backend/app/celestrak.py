from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from .config import get_settings
from .database import get_cached_at, get_cached_response, set_cached_response


class CelesTrakError(RuntimeError):
    pass


def cache_key_for_query(query: dict[str, str], fmt: str = "JSON") -> str:
    ordered = "&".join(f"{key}={query[key]}" for key in sorted(query))
    return f"{ordered}&FORMAT={fmt}"


def normalize_record(record: dict[str, Any]) -> dict[str, Any]:
    normalized: dict[str, Any] = {}
    for key, value in record.items():
        normalized[str(key).upper()] = value
    return normalized


def get_record_norad(record: dict[str, Any]) -> int:
    for key in ("NORAD_CAT_ID", "OBJECT_ID", "CATNR"):
        value = record.get(key)
        if value is not None and str(value).strip().isdigit():
            return int(value)
    raise CelesTrakError(f"Missing NORAD id in record: {record}")


def get_record_name(record: dict[str, Any]) -> str:
    return str(record.get("OBJECT_NAME") or record.get("OBJECT") or "UNKNOWN")


class CelesTrakClient:
    def __init__(self) -> None:
        self.settings = get_settings()

    def fetch_gp(self, query: dict[str, str], fmt: str = "JSON") -> list[dict[str, Any]]:
        key = cache_key_for_query(query, fmt)
        cached_at = get_cached_at(key)
        if cached_at:
            age = datetime.now(timezone.utc) - cached_at
            if age.total_seconds() < self.settings.cache_ttl_seconds:
                cached = get_cached_response(key)
                if isinstance(cached, list):
                    return [normalize_record(record) for record in cached]

        params = {**query, "FORMAT": fmt}
        url = f"{self.settings.celestrak_base_url}?{urlencode(params)}"
        request = Request(url, headers={"User-Agent": "NovarysSpaceMVP/0.1"})
        try:
            with urlopen(request, timeout=30) as response:
                if response.status != 200:
                    raise CelesTrakError(f"CelesTrak returned HTTP {response.status}")
                payload = response.read().decode("utf-8")
        except HTTPError as exc:
            raise CelesTrakError(f"CelesTrak HTTP {exc.code}: {exc.reason}") from exc
        except URLError as exc:
            raise CelesTrakError(f"CelesTrak network error: {exc.reason}") from exc

        try:
            parsed = json.loads(payload)
        except json.JSONDecodeError as exc:
            raise CelesTrakError("CelesTrak returned invalid JSON") from exc

        if isinstance(parsed, dict):
            parsed = [parsed]
        if not isinstance(parsed, list):
            raise CelesTrakError("CelesTrak JSON response was not a list")

        normalized = [normalize_record(record) for record in parsed]
        set_cached_response(key, normalized)
        return normalized
