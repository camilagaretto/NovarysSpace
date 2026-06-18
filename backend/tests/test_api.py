from fastapi.testclient import TestClient

from app import main
from app.database import clear_events, init_db, insert_event, utc_now_iso
from app.scanner import IngestSummary


client = TestClient(main.app)


def test_health_endpoint() -> None:
    response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_cors_allows_127_frontend_origin() -> None:
    response = client.options(
        "/api/events",
        headers={
            "Origin": "http://127.0.0.1:5173",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:5173"


def test_ingest_endpoint_uses_service(monkeypatch) -> None:
    monkeypatch.setattr(main, "ingest_records", lambda: IngestSummary(targets=4, candidates=20))

    response = client.post("/api/ingest")

    assert response.status_code == 200
    assert response.json()["targets"] == 4
    assert response.json()["candidates"] == 20


def test_scan_endpoint_uses_service(monkeypatch) -> None:
    monkeypatch.setattr(
        main,
        "scan_proximity_events",
        lambda days=5: {
            "days": days,
            "events_created": 1,
            "real_events": 0,
            "simulated_events": 1,
            "source": "CelesTrak",
            "computed_at": utc_now_iso(),
        },
    )

    response = client.post("/api/scan?days=3")

    assert response.status_code == 200
    assert response.json()["days"] == 3
    assert response.json()["simulated_events"] == 1


def test_events_endpoint_returns_inserted_event() -> None:
    init_db()
    clear_events()
    insert_event(
        {
            "target_norad": 43641,
            "target_name": "SAOCOM-1A",
            "object_norad": 12345,
            "object_name": "DEMO DEBRIS",
            "orbit_regime": "LEO",
            "tca_utc": "2026-06-18T12:00:00+00:00",
            "miss_distance_km": 3.2,
            "relative_speed_km_s": 11.4,
            "severity": "warning",
            "simulated": True,
            "source": "Demo simulation",
            "computed_at": utc_now_iso(),
        }
    )

    response = client.get("/api/events?severity=warning")

    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 1
    assert payload[0]["target_name"] == "SAOCOM-1A"
    assert payload[0]["simulated"] is True
