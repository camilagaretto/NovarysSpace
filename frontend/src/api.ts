import type { IngestResult, ProximityEvent, Report, Satellite, ScanResult } from "./types";

const API_URL =
  import.meta.env.VITE_API_URL ?? `${window.location.protocol}//${window.location.hostname}:8000`;

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.detail ?? `Request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function getSatellites(): Promise<Satellite[]> {
  return request<Satellite[]>("/api/satellites");
}

export function getCandidates(): Promise<Satellite[]> {
  return request<Satellite[]>("/api/candidates");
}


export function getEvents(query = ""): Promise<ProximityEvent[]> {
  return request<ProximityEvent[]>(`/api/events${query}`);
}

export function getReport(): Promise<Report> {
  return request<Report>("/api/report");
}

export function ingestData(): Promise<IngestResult> {
  return request<IngestResult>("/api/ingest", { method: "POST" });
}

export function scanEvents(days = 5): Promise<ScanResult> {
  return request<ScanResult>(`/api/scan?days=${days}`, { method: "POST" });
}
