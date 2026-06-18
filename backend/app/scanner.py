from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

from .catalog import GEO_CANDIDATE_QUERIES, LEO_CANDIDATE_QUERIES, TARGET_SATELLITES
from .celestrak import CelesTrakClient, get_record_name, get_record_norad
from .config import get_settings
from .database import (
    clear_events,
    get_orbital_records,
    insert_event,
    upsert_orbital_record,
    utc_now_iso,
)
from .orbital import (
    build_satrec,
    classify_severity,
    distance_km,
    propagate,
    relative_speed_km_s,
)


@dataclass
class IngestSummary:
    targets: int
    candidates: int
    source: str = "CelesTrak"


def infer_orbit_regime(record: dict[str, Any], default: str) -> str:
    try:
        mean_motion = float(record.get("MEAN_MOTION", 0))
    except (TypeError, ValueError):
        return default
    if 0.8 <= mean_motion <= 1.2:
        return "GEO"
    if mean_motion >= 10:
        return "LEO"
    return default


def ingest_records() -> IngestSummary:
    settings = get_settings()
    client = CelesTrakClient()
    target_count = 0
    candidate_count = 0

    for target in TARGET_SATELLITES:
        records = client.fetch_gp({"CATNR": str(target.norad_id)})
        if not records:
            continue
        record = records[0]
        upsert_orbital_record(
            norad_id=target.norad_id,
            role="target",
            name=target.name,
            orbit_regime=target.orbit_regime,
            raw_json=record,
        )
        target_count += 1

    candidates_by_regime: dict[str, list[dict[str, Any]]] = {"LEO": [], "GEO": []}

    for query in LEO_CANDIDATE_QUERIES:
        candidates_by_regime["LEO"].extend(
            client.fetch_gp(query)[: settings.candidate_limit_per_query]
        )

    for query in GEO_CANDIDATE_QUERIES:
        candidates_by_regime["GEO"].extend(
            client.fetch_gp(query)[: settings.candidate_limit_per_query]
        )

    seen: set[tuple[int, str]] = set()
    for default_regime, records in candidates_by_regime.items():
        stored_for_regime = 0
        for record in records:
            if stored_for_regime >= settings.max_candidates_per_regime:
                break
            try:
                norad_id = get_record_norad(record)
            except Exception:
                continue
            regime = infer_orbit_regime(record, default_regime)
            key = (norad_id, regime)
            if key in seen:
                continue
            seen.add(key)
            upsert_orbital_record(
                norad_id=norad_id,
                role="candidate",
                name=get_record_name(record),
                orbit_regime=regime,
                raw_json=record,
            )
            stored_for_regime += 1
            candidate_count += 1

    return IngestSummary(targets=target_count, candidates=candidate_count)


def _time_range(start: datetime, end: datetime, step: timedelta) -> list[datetime]:
    times: list[datetime] = []
    cursor = start
    while cursor <= end:
        times.append(cursor)
        cursor += step
    return times


def _best_approach(
    target_sat: Any,
    object_sat: Any,
    start: datetime,
    end: datetime,
) -> tuple[datetime, float, float] | None:
    settings = get_settings()
    coarse_step = timedelta(minutes=settings.coarse_step_minutes)
    refine_step = timedelta(seconds=settings.refine_step_seconds)

    best_time: datetime | None = None
    best_distance = float("inf")
    best_speed = 0.0

    for when in _time_range(start, end, coarse_step):
        try:
            target_pos, target_vel = propagate(target_sat, when)
            object_pos, object_vel = propagate(object_sat, when)
        except ValueError:
            continue
        current_distance = distance_km(target_pos, object_pos)
        if current_distance < best_distance:
            best_time = when
            best_distance = current_distance
            best_speed = relative_speed_km_s(target_vel, object_vel)

    if best_time is None:
        return None

    refine_start = max(start, best_time - coarse_step)
    refine_end = min(end, best_time + coarse_step)
    for when in _time_range(refine_start, refine_end, refine_step):
        try:
            target_pos, target_vel = propagate(target_sat, when)
            object_pos, object_vel = propagate(object_sat, when)
        except ValueError:
            continue
        current_distance = distance_km(target_pos, object_pos)
        if current_distance < best_distance:
            best_time = when
            best_distance = current_distance
            best_speed = relative_speed_km_s(target_vel, object_vel)

    return best_time, best_distance, best_speed


def _make_event(
    *,
    target: dict[str, Any],
    candidate: dict[str, Any],
    tca: datetime,
    miss_distance_km: float,
    relative_speed: float,
    simulated: bool,
) -> dict[str, Any]:
    return {
        "target_norad": target["norad_id"],
        "target_name": target["name"],
        "object_norad": candidate["norad_id"],
        "object_name": candidate["name"],
        "orbit_regime": target["orbit_regime"],
        "tca_utc": tca.replace(microsecond=0).isoformat(),
        "miss_distance_km": round(miss_distance_km, 3),
        "relative_speed_km_s": round(relative_speed, 4),
        "severity": classify_severity(miss_distance_km),
        "simulated": simulated,
        "source": "CelesTrak" if not simulated else "Demo simulation",
        "computed_at": utc_now_iso(),
    }


def _ensure_demo_event(targets: list[dict[str, Any]], candidates: list[dict[str, Any]]) -> dict[str, Any]:
    target = next((item for item in targets if item["orbit_regime"] == "LEO"), targets[0])
    candidate = next(
        (item for item in candidates if item["orbit_regime"] == target["orbit_regime"]),
        candidates[0] if candidates else {
            "norad_id": 99999,
            "name": "DEMO ORBITAL OBJECT",
            "orbit_regime": target["orbit_regime"],
        },
    )
    return _make_event(
        target=target,
        candidate=candidate,
        tca=datetime.now(timezone.utc) + timedelta(hours=18),
        miss_distance_km=3.2,
        relative_speed=11.4 if target["orbit_regime"] == "LEO" else 0.9,
        simulated=True,
    )


def scan_proximity_events(days: int = 5) -> dict[str, Any]:
    settings = get_settings()
    targets = get_orbital_records(role="target")
    candidates = get_orbital_records(role="candidate")
    if not targets or not candidates:
        ingest_records()
        targets = get_orbital_records(role="target")
        candidates = get_orbital_records(role="candidate")

    if not targets:
        raise RuntimeError("No target satellites available. Run ingest first.")

    clear_events()

    start = datetime.now(timezone.utc).replace(microsecond=0)
    end = start + timedelta(days=days)
    events: list[dict[str, Any]] = []

    sat_cache: dict[tuple[str, int], Any] = {}
    for target in targets:
        try:
            target_sat = sat_cache.setdefault(
                ("target", target["norad_id"]),
                build_satrec(target["raw_json"]),
            )
        except Exception:
            continue

        relevant_candidates = [
            candidate
            for candidate in candidates
            if candidate["orbit_regime"] == target["orbit_regime"]
            and candidate["norad_id"] != target["norad_id"]
        ]

        for candidate in relevant_candidates:
            try:
                candidate_sat = sat_cache.setdefault(
                    ("candidate", candidate["norad_id"]),
                    build_satrec(candidate["raw_json"]),
                )
            except Exception:
                continue

            best = _best_approach(target_sat, candidate_sat, start, end)
            if best is None:
                continue
            tca, miss_distance, speed = best
            if miss_distance <= settings.scan_threshold_km:
                events.append(
                    _make_event(
                        target=target,
                        candidate=candidate,
                        tca=tca,
                        miss_distance_km=miss_distance,
                        relative_speed=speed,
                        simulated=False,
                    )
                )

    if not events:
        events.append(_ensure_demo_event(targets, candidates))

    event_ids = [insert_event(event) for event in events]
    return {
        "days": days,
        "events_created": len(event_ids),
        "real_events": sum(1 for event in events if not event["simulated"]),
        "simulated_events": sum(1 for event in events if event["simulated"]),
        "source": "CelesTrak",
        "computed_at": utc_now_iso(),
    }
