from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .database import get_orbital_records, init_db, list_events, utc_now_iso
from .scanner import ingest_records, scan_proximity_events
from .schemas import (
    HealthResponse,
    IngestResponse,
    ProximityEventResponse,
    ReportResponse,
    SatelliteResponse,
    ScanResponse,
)


settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="Novarys Space API",
    description="MVP API for estimated orbital proximity monitoring.",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_origin,
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(status="ok", service="novarys-space-api")


@app.post("/api/ingest", response_model=IngestResponse)
def ingest() -> IngestResponse:
    try:
        summary = ingest_records()
    except Exception as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return IngestResponse(
        targets=summary.targets,
        candidates=summary.candidates,
        source=summary.source,
    )


@app.post("/api/scan", response_model=ScanResponse)
def scan(days: int = Query(default=5, ge=1, le=14)) -> ScanResponse:
    try:
        result = scan_proximity_events(days=days)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc)) from exc
    return ScanResponse(**result)


@app.get("/api/satellites", response_model=list[SatelliteResponse])
def satellites() -> list[SatelliteResponse]:
    records = get_orbital_records(role="target")
    return [
        SatelliteResponse(
            norad_id=record["norad_id"],
            role=record["role"],
            name=record["name"],
            orbit_regime=record["orbit_regime"],
            fetched_at=record["fetched_at"],
            raw_json=record["raw_json"],
        )
        for record in records
    ]


@app.get("/api/candidates", response_model=list[SatelliteResponse])
def candidates() -> list[SatelliteResponse]:
    records = get_orbital_records(role="candidate")
    return [
        SatelliteResponse(
            norad_id=record["norad_id"],
            role=record["role"],
            name=record["name"],
            orbit_regime=record["orbit_regime"],
            fetched_at=record["fetched_at"],
            raw_json=record["raw_json"],
        )
        for record in records
    ]



@app.get("/api/events", response_model=list[ProximityEventResponse])
def events(
    target_norad: int | None = None,
    severity: str | None = None,
    simulated: bool | None = None,
    orbit_regime: str | None = None,
) -> list[ProximityEventResponse]:
    return [
        ProximityEventResponse(**event)
        for event in list_events(
            target_norad=target_norad,
            severity=severity,
            simulated=simulated,
            orbit_regime=orbit_regime,
        )
    ]


@app.get("/api/report", response_model=ReportResponse)
def report() -> ReportResponse:
    all_events = list_events()
    targets = get_orbital_records(role="target")
    severity_counts: dict[str, int] = {}
    for event in all_events:
        severity_counts[event["severity"]] = severity_counts.get(event["severity"], 0) + 1
    closest_event = min(all_events, key=lambda event: event["miss_distance_km"], default=None)
    return ReportResponse(
        total_events=len(all_events),
        real_events=sum(1 for event in all_events if not event["simulated"]),
        simulated_events=sum(1 for event in all_events if event["simulated"]),
        severity_counts=severity_counts,
        satellites_monitored=len(targets),
        closest_event=ProximityEventResponse(**closest_event) if closest_event else None,
        generated_at=utc_now_iso(),
    )
