from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator

from .config import get_settings


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def get_db_path() -> Path:
    path = get_settings().db_path
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


@contextmanager
def connect() -> Iterator[sqlite3.Connection]:
    conn = sqlite3.connect(get_db_path())
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with connect() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS request_cache (
                cache_key TEXT PRIMARY KEY,
                response_json TEXT NOT NULL,
                fetched_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS orbital_records (
                norad_id INTEGER NOT NULL,
                role TEXT NOT NULL,
                name TEXT NOT NULL,
                orbit_regime TEXT NOT NULL,
                raw_json TEXT NOT NULL,
                fetched_at TEXT NOT NULL,
                PRIMARY KEY (norad_id, role)
            );

            CREATE TABLE IF NOT EXISTS proximity_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                target_norad INTEGER NOT NULL,
                target_name TEXT NOT NULL,
                object_norad INTEGER NOT NULL,
                object_name TEXT NOT NULL,
                orbit_regime TEXT NOT NULL,
                tca_utc TEXT NOT NULL,
                miss_distance_km REAL NOT NULL,
                relative_speed_km_s REAL NOT NULL,
                severity TEXT NOT NULL,
                simulated INTEGER NOT NULL,
                source TEXT NOT NULL,
                computed_at TEXT NOT NULL
            );
            """
        )


def get_cached_response(cache_key: str) -> dict[str, Any] | list[dict[str, Any]] | None:
    with connect() as conn:
        row = conn.execute(
            "SELECT response_json FROM request_cache WHERE cache_key = ?",
            (cache_key,),
        ).fetchone()
    if not row:
        return None
    return json.loads(row["response_json"])


def get_cached_at(cache_key: str) -> datetime | None:
    with connect() as conn:
        row = conn.execute(
            "SELECT fetched_at FROM request_cache WHERE cache_key = ?",
            (cache_key,),
        ).fetchone()
    if not row:
        return None
    return datetime.fromisoformat(row["fetched_at"])


def set_cached_response(cache_key: str, payload: Any) -> None:
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO request_cache (cache_key, response_json, fetched_at)
            VALUES (?, ?, ?)
            ON CONFLICT(cache_key) DO UPDATE SET
                response_json = excluded.response_json,
                fetched_at = excluded.fetched_at
            """,
            (cache_key, json.dumps(payload), utc_now_iso()),
        )


def upsert_orbital_record(
    *,
    norad_id: int,
    role: str,
    name: str,
    orbit_regime: str,
    raw_json: dict[str, Any],
) -> None:
    with connect() as conn:
        conn.execute(
            """
            INSERT INTO orbital_records
                (norad_id, role, name, orbit_regime, raw_json, fetched_at)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(norad_id, role) DO UPDATE SET
                name = excluded.name,
                orbit_regime = excluded.orbit_regime,
                raw_json = excluded.raw_json,
                fetched_at = excluded.fetched_at
            """,
            (norad_id, role, name, orbit_regime, json.dumps(raw_json), utc_now_iso()),
        )


def get_orbital_records(role: str | None = None) -> list[dict[str, Any]]:
    query = "SELECT * FROM orbital_records"
    params: tuple[Any, ...] = ()
    if role:
        query += " WHERE role = ?"
        params = (role,)
    query += " ORDER BY orbit_regime, name"
    with connect() as conn:
        rows = conn.execute(query, params).fetchall()
    return [
        {
            "norad_id": row["norad_id"],
            "role": row["role"],
            "name": row["name"],
            "orbit_regime": row["orbit_regime"],
            "raw_json": json.loads(row["raw_json"]),
            "fetched_at": row["fetched_at"],
        }
        for row in rows
    ]


def clear_events() -> None:
    with connect() as conn:
        conn.execute("DELETE FROM proximity_events")


def insert_event(event: dict[str, Any]) -> int:
    with connect() as conn:
        cursor = conn.execute(
            """
            INSERT INTO proximity_events (
                target_norad, target_name, object_norad, object_name,
                orbit_regime, tca_utc, miss_distance_km, relative_speed_km_s,
                severity, simulated, source, computed_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                event["target_norad"],
                event["target_name"],
                event["object_norad"],
                event["object_name"],
                event["orbit_regime"],
                event["tca_utc"],
                event["miss_distance_km"],
                event["relative_speed_km_s"],
                event["severity"],
                int(event["simulated"]),
                event["source"],
                event["computed_at"],
            ),
        )
        return int(cursor.lastrowid)


def list_events(
    *,
    target_norad: int | None = None,
    severity: str | None = None,
    simulated: bool | None = None,
    orbit_regime: str | None = None,
) -> list[dict[str, Any]]:
    clauses: list[str] = []
    params: list[Any] = []
    if target_norad is not None:
        clauses.append("target_norad = ?")
        params.append(target_norad)
    if severity:
        clauses.append("severity = ?")
        params.append(severity)
    if simulated is not None:
        clauses.append("simulated = ?")
        params.append(int(simulated))
    if orbit_regime:
        clauses.append("orbit_regime = ?")
        params.append(orbit_regime.upper())

    query = "SELECT * FROM proximity_events"
    if clauses:
        query += " WHERE " + " AND ".join(clauses)
    query += " ORDER BY tca_utc ASC"

    with connect() as conn:
        rows = conn.execute(query, tuple(params)).fetchall()
    return [dict(row) | {"simulated": bool(row["simulated"])} for row in rows]
