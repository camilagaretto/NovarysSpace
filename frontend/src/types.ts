export type Severity = "critical" | "warning" | "info" | "observe" | "none";

export interface Satellite {
  norad_id: number;
  role: string;
  name: string;
  orbit_regime: "LEO" | "GEO";
  fetched_at: string;
}

export interface ProximityEvent {
  id: number;
  target_norad: number;
  target_name: string;
  object_norad: number;
  object_name: string;
  orbit_regime: "LEO" | "GEO";
  tca_utc: string;
  miss_distance_km: number;
  relative_speed_km_s: number;
  severity: Severity;
  simulated: boolean;
  source: string;
  computed_at: string;
}

export interface Report {
  total_events: number;
  real_events: number;
  simulated_events: number;
  severity_counts: Record<string, number>;
  satellites_monitored: number;
  closest_event: ProximityEvent | null;
  generated_at: string;
}

export interface ScanResult {
  days: number;
  events_created: number;
  real_events: number;
  simulated_events: number;
  source: string;
  computed_at: string;
}

export interface IngestResult {
  targets: number;
  candidates: number;
  source: string;
}
