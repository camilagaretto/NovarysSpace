import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  Database,
  Filter,
  Radar,
  RefreshCcw,
  Satellite as SatelliteIcon
} from "lucide-react";
import { getEvents, getReport, getSatellites, ingestData, scanEvents } from "./api";
import type { ProximityEvent, Report, Satellite } from "./types";

const severityLabels: Record<string, string> = {
  critical: "Critico",
  warning: "Advertencia",
  info: "Informativo",
  observe: "Observacion",
  none: "Sin alerta"
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "UTC"
  }).format(new Date(value));
}

function App() {
  const [satellites, setSatellites] = useState<Satellite[]>([]);
  const [events, setEvents] = useState<ProximityEvent[]>([]);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Backend listo para cargar datos orbitales.");
  const [error, setError] = useState<string | null>(null);
  const [selectedSatellite, setSelectedSatellite] = useState("");
  const [selectedSeverity, setSelectedSeverity] = useState("");
  const [selectedRegime, setSelectedRegime] = useState("");

  async function refreshData() {
    setError(null);
    const params = new URLSearchParams();
    if (selectedSatellite) params.set("target_norad", selectedSatellite);
    if (selectedSeverity) params.set("severity", selectedSeverity);
    if (selectedRegime) params.set("orbit_regime", selectedRegime);
    const query = params.toString() ? `?${params.toString()}` : "";
    const [satelliteData, eventData, reportData] = await Promise.all([
      getSatellites(),
      getEvents(query),
      getReport()
    ]);
    setSatellites(satelliteData);
    setEvents(eventData);
    setReport(reportData);
  }

  async function handleIngest() {
    setLoading(true);
    setError(null);
    try {
      const result = await ingestData();
      setMessage(`Datos actualizados: ${result.targets} objetivos y ${result.candidates} candidatos.`);
      await refreshData();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo actualizar CelesTrak.");
    } finally {
      setLoading(false);
    }
  }

  async function handleScan() {
    setLoading(true);
    setError(null);
    try {
      const result = await scanEvents(5);
      setMessage(`Escaneo completo: ${result.events_created} eventos en ${result.days} dias.`);
      await refreshData();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo ejecutar el escaneo.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshData().catch(() => {
      setError("No se pudo conectar con el backend local.");
    });
  }, []);

  useEffect(() => {
    refreshData().catch((caught) => {
      setError(caught instanceof Error ? caught.message : "No se pudieron aplicar filtros.");
    });
  }, [selectedSatellite, selectedSeverity, selectedRegime]);

  const closest = report?.closest_event;
  const severityOptions = useMemo(
    () => Object.keys(report?.severity_counts ?? severityLabels),
    [report]
  );

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Novarys Space MVP</p>
          <h1>Monitor de proximidad orbital</h1>
        </div>
        <div className="actions">
          <button type="button" onClick={handleIngest} disabled={loading} title="Actualizar datos">
            <Database size={18} />
            Actualizar datos
          </button>
          <button type="button" onClick={handleScan} disabled={loading} title="Ejecutar escaneo">
            <Radar size={18} />
            Ejecutar escaneo
          </button>
        </div>
      </header>

      <section className="status-band">
        <Activity size={18} />
        <span>{loading ? "Procesando..." : message}</span>
        {error && <strong>{error}</strong>}
      </section>

      <section className="metrics-grid" aria-label="Resumen orbital">
        <article className="metric-card">
          <SatelliteIcon size={20} />
          <span>Satelites</span>
          <strong>{report?.satellites_monitored ?? satellites.length}</strong>
        </article>
        <article className="metric-card">
          <AlertTriangle size={20} />
          <span>Eventos</span>
          <strong>{report?.total_events ?? events.length}</strong>
        </article>
        <article className="metric-card">
          <Radar size={20} />
          <span>Reales</span>
          <strong>{report?.real_events ?? 0}</strong>
        </article>
        <article className="metric-card">
          <RefreshCcw size={20} />
          <span>Simulados</span>
          <strong>{report?.simulated_events ?? 0}</strong>
        </article>
      </section>

      <section className="content-grid">
        <div className="events-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Eventos</p>
              <h2>Aproximaciones estimadas</h2>
            </div>
            <div className="filters" aria-label="Filtros">
              <Filter size={18} />
              <select value={selectedSatellite} onChange={(event) => setSelectedSatellite(event.target.value)}>
                <option value="">Todos</option>
                {satellites.map((satellite) => (
                  <option key={satellite.norad_id} value={satellite.norad_id}>
                    {satellite.name}
                  </option>
                ))}
              </select>
              <select value={selectedRegime} onChange={(event) => setSelectedRegime(event.target.value)}>
                <option value="">LEO + GEO</option>
                <option value="LEO">LEO</option>
                <option value="GEO">GEO</option>
              </select>
              <select value={selectedSeverity} onChange={(event) => setSelectedSeverity(event.target.value)}>
                <option value="">Severidad</option>
                {severityOptions.map((severity) => (
                  <option key={severity} value={severity}>
                    {severityLabels[severity] ?? severity}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Objetivo</th>
                  <th>Objeto cercano</th>
                  <th>Orbita</th>
                  <th>TCA UTC</th>
                  <th>Distancia</th>
                  <th>Velocidad rel.</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {events.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="empty-state">
                      Sin eventos cargados.
                    </td>
                  </tr>
                ) : (
                  events.map((event) => (
                    <tr key={event.id}>
                      <td>
                        <strong>{event.target_name}</strong>
                        <span>NORAD {event.target_norad}</span>
                      </td>
                      <td>
                        <strong>{event.object_name}</strong>
                        <span>NORAD {event.object_norad}</span>
                      </td>
                      <td>{event.orbit_regime}</td>
                      <td>{formatDate(event.tca_utc)}</td>
                      <td>{event.miss_distance_km.toFixed(3)} km</td>
                      <td>{event.relative_speed_km_s.toFixed(3)} km/s</td>
                      <td>
                        <span className={`badge ${event.severity}`}>
                          {severityLabels[event.severity] ?? event.severity}
                        </span>
                        {event.simulated && <span className="tag">demo</span>}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <aside className="side-panel">
          <section>
            <p className="eyebrow">Evento mas cercano</p>
            {closest ? (
              <div className="closest">
                <strong>{closest.target_name}</strong>
                <span>{closest.object_name}</span>
                <b>{closest.miss_distance_km.toFixed(3)} km</b>
                <small>{formatDate(closest.tca_utc)} UTC</small>
              </div>
            ) : (
              <p className="muted">Todavia no hay eventos calculados.</p>
            )}
          </section>

          <section>
            <p className="eyebrow">Metodo</p>
            <p className="method-copy">
              CelesTrak entrega elementos orbitales publicos. El backend propaga cada orbita con
              SGP4, compara posiciones por ventana temporal y registra TCA, distancia minima y
              severidad estimada.
            </p>
          </section>

          <section>
            <p className="eyebrow">Limitacion</p>
            <p className="method-copy">
              El MVP no calcula probabilidad operacional de colision ni usa covarianzas. Los eventos
              indican proximidad estimada y requieren revision tecnica.
            </p>
          </section>
        </aside>
      </section>
    </main>
  );
}

export default App;
