from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    service: str


class IngestResponse(BaseModel):
    targets: int
    candidates: int
    source: str


class ScanResponse(BaseModel):
    days: int
    events_created: int
    real_events: int
    simulated_events: int
    source: str
    computed_at: str


class SatelliteResponse(BaseModel):
    norad_id: int
    role: str
    name: str
    orbit_regime: str
    fetched_at: str


class ProximityEventResponse(BaseModel):
    id: int
    target_norad: int
    target_name: str
    object_norad: int
    object_name: str
    orbit_regime: str
    tca_utc: str
    miss_distance_km: float
    relative_speed_km_s: float
    severity: str
    simulated: bool
    source: str
    computed_at: str


class ReportResponse(BaseModel):
    total_events: int
    real_events: int
    simulated_events: int
    severity_counts: dict[str, int]
    satellites_monitored: int
    closest_event: ProximityEventResponse | None
    generated_at: str
