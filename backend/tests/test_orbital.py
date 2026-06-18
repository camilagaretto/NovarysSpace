from datetime import datetime, timezone

from app.orbital import classify_severity, distance_km, relative_speed_km_s


def test_distance_km_uses_3d_euclidean_distance() -> None:
    assert distance_km((0, 0, 0), (3, 4, 12)) == 13


def test_relative_speed_km_s_uses_3d_euclidean_distance() -> None:
    assert relative_speed_km_s((7, 1, 2), (4, 5, 2)) == 5


def test_classify_severity_thresholds() -> None:
    assert classify_severity(0.9) == "critical"
    assert classify_severity(4.9) == "warning"
    assert classify_severity(9.9) == "info"
    assert classify_severity(50.0) == "observe"
    assert classify_severity(50.1) == "none"


def test_datetime_fixture_is_utc_aware() -> None:
    when = datetime(2026, 6, 18, 12, 0, tzinfo=timezone.utc)
    assert when.tzinfo is not None
