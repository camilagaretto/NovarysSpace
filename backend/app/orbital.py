from __future__ import annotations

from datetime import datetime, timezone
from math import sqrt
from typing import Any

from sgp4 import omm
from sgp4.api import Satrec, jday


Vector = tuple[float, float, float]


def build_satrec(record: dict[str, Any]) -> Satrec:
    sat = Satrec()
    omm.initialize(sat, {key: str(value) for key, value in record.items()})
    return sat


def to_utc(dt: datetime) -> datetime:
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def propagate(satrec: Satrec, when: datetime) -> tuple[Vector, Vector]:
    when = to_utc(when)
    seconds = when.second + when.microsecond / 1_000_000
    jd, fr = jday(when.year, when.month, when.day, when.hour, when.minute, seconds)
    error, position, velocity = satrec.sgp4(jd, fr)
    if error != 0:
        raise ValueError(f"SGP4 propagation failed with code {error}")
    return tuple(position), tuple(velocity)


def distance_km(a: Vector, b: Vector) -> float:
    return sqrt(sum((left - right) ** 2 for left, right in zip(a, b)))


def relative_speed_km_s(a: Vector, b: Vector) -> float:
    return sqrt(sum((left - right) ** 2 for left, right in zip(a, b)))


def classify_severity(miss_distance_km: float) -> str:
    if miss_distance_km < 1:
        return "critical"
    if miss_distance_km < 5:
        return "warning"
    if miss_distance_km < 10:
        return "info"
    if miss_distance_km <= 50:
        return "observe"
    return "none"
