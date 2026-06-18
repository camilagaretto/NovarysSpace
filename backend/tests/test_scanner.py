from app.scanner import _ensure_demo_event, infer_orbit_regime


def test_infer_orbit_regime_from_mean_motion() -> None:
    assert infer_orbit_regime({"MEAN_MOTION": "15.2"}, "GEO") == "LEO"
    assert infer_orbit_regime({"MEAN_MOTION": "1.0"}, "LEO") == "GEO"
    assert infer_orbit_regime({"MEAN_MOTION": "5.0"}, "LEO") == "LEO"


def test_ensure_demo_event_marks_simulated_warning() -> None:
    event = _ensure_demo_event(
        targets=[
            {
                "norad_id": 43641,
                "name": "SAOCOM-1A",
                "orbit_regime": "LEO",
            }
        ],
        candidates=[
            {
                "norad_id": 12345,
                "name": "COSMOS 2251 DEB",
                "orbit_regime": "LEO",
            }
        ],
    )

    assert event["target_name"] == "SAOCOM-1A"
    assert event["object_name"] == "COSMOS 2251 DEB"
    assert event["simulated"] is True
    assert event["severity"] == "warning"
