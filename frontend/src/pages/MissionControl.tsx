import React, { useEffect, useState, useMemo, useRef, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import {
  Activity,
  AlertTriangle,
  Database,
  Filter,
  Play,
  Pause,
  RotateCcw,
  Eye,
  EyeOff,
  ChevronRight,
  Info,
  Clock,
  Zap,
  Globe as GlobeIcon,
  ShieldAlert,
  ShieldCheck,
  Calendar,
  Search,
  FileSpreadsheet
} from "lucide-react";
import { getSatellites, getCandidates, getEvents, getReport, ingestData, scanEvents } from "../api";
import { EARTH_RADIUS_3D } from "../services/orbital";
import { EarthScene } from "../components/EarthScene";
import { OrbitLayer } from "../components/OrbitLayer";
import { SatelliteLayer } from "../components/SatelliteLayer";
import { EventLayer } from "../components/EventLayer";
import { SpaceCamera } from "../components/SpaceCamera";
import { EventDrawer } from "../components/EventDrawer";
import { AnalyticsView } from "../components/AnalyticsView";
import { ReportsView } from "../components/ReportsView";
import { getSatellitePosition } from "../services/orbital";
import { calculateRisk } from "../utils/calculateRisk";
import type { ProximityEvent, Report, Satellite } from "../types";

export function MissionControl() {
  // Core Data
  const [satellites, setSatellites] = useState<Satellite[]>([]);
  const [candidates, setCandidates] = useState<Satellite[]>([]);
  const [events, setEvents] = useState<ProximityEvent[]>([]);
  const [report, setReport] = useState<Report | null>(null);

  // Tab Navigation State (Overview, Events, 3D Orbit View, Analytics, Reports)
  const [activeTab, setActiveTab] = useState<"overview" | "events" | "3d" | "analytics" | "reports">("overview");

  // Loading & Operations Message
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Sistemas en línea. Esperando datos...");
  const [error, setError] = useState<string | null>(null);
  const [showWarningModal, setShowWarningModal] = useState(false);

  // Time & Simulation Clock
  const [currentTime, setCurrentTime] = useState<Date>(new Date());
  const [isPaused, setIsPaused] = useState(false);
  const [timeMultiplier, setTimeMultiplier] = useState(1);

  // 3D View Layer Controllers
  const [showLEO, setShowLEO] = useState(true);
  const [showGEO, setShowGEO] = useState(true);
  const [showTargets, setShowTargets] = useState(true);
  const [showCandidates, setShowCandidates] = useState(true);

  // 3D Selection
  const [selectedSatellite, setSelectedSatellite] = useState<Satellite | null>(null);
  const [selectedTelemetry, setSelectedTelemetry] = useState<any>(null);
  const [cameraTarget, setCameraTarget] = useState<[number, number, number] | null>(null);

  // Replay State
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [isReplayMode, setIsReplayMode] = useState(false);
  const [replayStartTime, setReplayStartTime] = useState<Date | null>(null);
  const [replayTcaTime, setReplayTcaTime] = useState<Date | null>(null);

  // Drawer details state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedEventForDrawer, setSelectedEventForDrawer] = useState<ProximityEvent | null>(null);

  // Filters State for Events Tab
  const [filterSeverity, setFilterSeverity] = useState("");
  const [filterSatellite, setFilterSatellite] = useState("");
  const [globalSearch, setGlobalSearch] = useState("");
  const [eventsFilterDateFrom, setEventsFilterDateFrom] = useState("");
  const [eventsFilterDateTo, setEventsFilterDateTo] = useState("");

  const requestRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(performance.now());
  const hasPausedAtTcaRef = useRef<boolean>(false);

  // Fetch API data
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [satList, candList, reportData] = await Promise.all([
        getSatellites(),
        getCandidates(),
        getReport()
      ]);

      const eventList = await getEvents();

      setSatellites(satList);
      setCandidates(candList);
      setReport(reportData);
      setEvents(eventList);
      setMessage("Conexión con el servidor SSA establecida.");
    } catch (e) {
      setError("Error al sincronizar con el backend orbital.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Clock tick animation loop
  useEffect(() => {
    const tick = (now: number) => {
      const deltaMs = now - lastTimeRef.current;
      lastTimeRef.current = now;

      if (!isPaused) {
        setCurrentTime((prevTime) => {
          const addedMs = deltaMs * timeMultiplier;
          const nextTime = new Date(prevTime.getTime() + addedMs);

          if (isReplayMode && replayTcaTime && !hasPausedAtTcaRef.current) {
            if (prevTime < replayTcaTime && nextTime >= replayTcaTime) {
              hasPausedAtTcaRef.current = true;
              setTimeout(() => setIsPaused(true), 0);
              return replayTcaTime;
            }
          }

          if (isReplayMode && replayTcaTime) {
            const tenMinutesAfter = new Date(replayTcaTime.getTime() + 10 * 60 * 1000);
            if (nextTime > tenMinutesAfter) {
              if (replayStartTime) return replayStartTime;
            }
          }
          return nextTime;
        });
      }
      requestRef.current = requestAnimationFrame(tick);
    };

    lastTimeRef.current = performance.now();
    requestRef.current = requestAnimationFrame(tick);

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [isPaused, timeMultiplier, isReplayMode, replayStartTime, replayTcaTime]);

  // Orbit camera look-at tracking
  useEffect(() => {
    if (isReplayMode && selectedEventId) {
      const event = events.find((e) => e.id === selectedEventId);
      if (event) {
        const targetObj = satellites.find((s) => s.norad_id === event.target_norad);
        const candidateObj = candidates.find((c) => c.norad_id === event.object_norad);
        if (targetObj && candidateObj) {
          const posT = getSatellitePosition(targetObj.raw_json, currentTime);
          const posC = getSatellitePosition(candidateObj.raw_json, currentTime);
          if (posT && posC) {
            setCameraTarget([(posT.x + posC.x) / 2, (posT.y + posC.y) / 2, (posT.z + posC.z) / 2]);
          }
        }
      }
    } else if (selectedSatellite) {
      const pos = getSatellitePosition(selectedSatellite.raw_json, currentTime);
      if (pos) {
        setCameraTarget([pos.x, pos.y, pos.z]);
        setSelectedTelemetry({
          altitude: pos.altitude,
          velocity: pos.velocity
        });
      }
    }
  }, [currentTime, selectedSatellite, isReplayMode, selectedEventId, satellites, candidates, events]);

  // Start 3D Replay
  const handleStartReplay = (event: ProximityEvent) => {
    setSelectedEventId(event.id);
    setIsReplayMode(true);
    setIsPaused(false);
    hasPausedAtTcaRef.current = false;
    setTimeMultiplier(60); // 60x (1 min/s)

    const tca = new Date(event.tca_utc);
    setReplayTcaTime(tca);
    const start = new Date(tca.getTime() - 30 * 60 * 1000); // 30 mins before
    setReplayStartTime(start);
    setCurrentTime(start);

    const targetObj = satellites.find((s) => s.norad_id === event.target_norad);
    if (targetObj) {
      setSelectedSatellite(targetObj);
    }
    setActiveTab("3d");
  };

  const handleStopReplay = () => {
    setIsReplayMode(false);
    setSelectedEventId(null);
    setTimeMultiplier(1);
    setReplayStartTime(null);
    setReplayTcaTime(null);
    setCameraTarget(null);
    setSelectedSatellite(null);
    setSelectedTelemetry(null);
  };

  // Sync data & run scans
  const handleUpdateData = async () => {
    try {
      setLoading(true);
      setMessage("Sincronizando TLEs públicos con CelesTrak...");
      await ingestData();
      setMessage("Datos actualizados correctamente.");
      await fetchData();
    } catch (e: any) {
      setError("Error al sincronizar datos.");
    } finally {
      setLoading(false);
    }
  };

  const handleRunScan = async () => {
    try {
      setLoading(true);
      setMessage("Calculando aproximaciones SGP4...");
      await scanEvents(5);
      setMessage("Escaneo orbital completado.");
      await fetchData();
    } catch (e: any) {
      setError("Error al ejecutar el escaneo.");
    } finally {
      setLoading(false);
    }
  };

  // Click on a table row opens details Drawer
  const handleRowClick = (event: ProximityEvent) => {
    setSelectedEventForDrawer(event);
    setDrawerOpen(true);
  };

  const formatDate = (val: string) => {
    return new Intl.DateTimeFormat("es-AR", {
      dateStyle: "short",
      timeStyle: "medium",
      timeZone: "UTC"
    }).format(new Date(val));
  };

  // Calculate dynamic critical alerts count in frontend
  const criticalAlertsCount = useMemo(() => {
    return events.filter((e) => calculateRisk(e.miss_distance_km).label === "CRITICAL").length;
  }, [events]);

  // Sort events to show highest severity and closest first
  const sortedRecentEvents = useMemo(() => {
    return [...events]
      .sort((a, b) => {
        const pA = calculateRisk(a.miss_distance_km).priority;
        const pB = calculateRisk(b.miss_distance_km).priority;
        if (pA !== pB) return pA - pB;
        return a.miss_distance_km - b.miss_distance_km;
      })
      .slice(0, 5);
  }, [events]);

  // Filter logic for Events tab
  const filteredEventsForTable = useMemo(() => {
    return events.filter((ev) => {
      const risk = calculateRisk(ev.miss_distance_km);
      const targetSat = satellites.find((s) => s.norad_id === ev.target_norad);

      if (globalSearch) {
        const query = globalSearch.toLowerCase();
        const matchesTargetName = ev.target_name.toLowerCase().includes(query);
        const matchesObjectName = ev.object_name.toLowerCase().includes(query);
        const matchesNorad = ev.target_norad.toString().includes(query) || ev.object_norad.toString().includes(query);
        const matchesOperator = (targetSat?.raw_json?.OPERATOR || "CONAE").toLowerCase().includes(query);
        if (!matchesTargetName && !matchesObjectName && !matchesNorad && !matchesOperator) return false;
      }

      if (eventsFilterDateFrom) {
        if (new Date(ev.tca_utc).getTime() < new Date(eventsFilterDateFrom).getTime()) return false;
      }
      if (eventsFilterDateTo) {
        if (new Date(ev.tca_utc).getTime() > new Date(eventsFilterDateTo).getTime()) return false;
      }
      if (filterSatellite && ev.target_norad.toString() !== filterSatellite) return false;
      if (filterSeverity && risk.label !== filterSeverity) return false;

      return true;
    });
  }, [events, globalSearch, eventsFilterDateFrom, eventsFilterDateTo, filterSatellite, filterSeverity, satellites]);

  // Next TCA in future
  const nextPredictedTca = useMemo(() => {
    const future = events
      .filter((e) => new Date(e.tca_utc) > new Date())
      .sort((a, b) => new Date(a.tca_utc).getTime() - new Date(b.tca_utc).getTime());
    if (future.length === 0) return "N/D";
    return formatDate(future[0].tca_utc);
  }, [events]);

  return (
    <div className="mission-control-container">
      {/* Upper Header and Navigation Tabs */}
      <header className="header-dashboard">
        <div className="title-section">
          <div className="logo-badge">
            <GlobeIcon className="animate-spin-slow text-cyan" size={18} />
            <span>SSA CORE</span>
          </div>
          <h1>Novarys Space</h1>
          <p className="subtitle font-mono">MISSION CONTROL & ORBITAL SITUATIONAL AWARENESS</p>
        </div>

        {/* 5-Tab Navigation Bar */}
        <div className="tabs-nav">
          <button className={`btn-tab ${activeTab === "overview" ? "active" : ""}`} onClick={() => setActiveTab("overview")}>
            Overview
          </button>
          <button className={`btn-tab ${activeTab === "events" ? "active" : ""}`} onClick={() => setActiveTab("events")}>
            Events
          </button>
          <button className={`btn-tab ${activeTab === "3d" ? "active" : ""}`} onClick={() => setActiveTab("3d")}>
            3D Orbit View
          </button>
          <button className={`btn-tab ${activeTab === "analytics" ? "active" : ""}`} onClick={() => setActiveTab("analytics")}>
            Analytics
          </button>
          <button className={`btn-tab ${activeTab === "reports" ? "active" : ""}`} onClick={() => setActiveTab("reports")}>
            Reports
          </button>
        </div>
      </header>

      <div className="dashboard-grid">
        {/* TAB 1: OVERVIEW */}
        {activeTab === "overview" && (
          <div className="dashboard-tab-content scrollbar-custom" style={{ width: "100%" }}>
            
            {/* High-impact space command hero header */}
            <div className="overview-hero">
              <div className="overview-hero-badge">
                // ORBITAL SITUATIONAL AWARENESS
              </div>
              <h1 className="overview-hero-title">NOVARYS SPACE</h1>
              <p className="overview-hero-subtitle">
                Centro de monitoreo de basura espacial y alertas operacionales en tiempo real. 
                Detección continua de aproximaciones orbitales utilizando propagación matemática SGP4.
              </p>
            </div>

            {/* KPI Cards Grid */}
            <div className="dashboard-stats-grid">
              <div className="stat-card">
                <span className="stat-label">Total Alerts</span>
                <span className="stat-val text-yellow">{events.length}</span>
              </div>
              <div className="stat-card" style={{ borderLeft: "4px solid #FF3B5C" }}>
                <span className="stat-label">Critical Alerts</span>
                <span className="stat-val text-red animate-pulse">{criticalAlertsCount}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Satellites Monitored</span>
                <span className="stat-val text-green">{satellites.length}</span>
              </div>
              <div className="stat-card">
                <span className="stat-label">Next Predicted Event</span>
                <span className="stat-val text-cyan" style={{ fontSize: "1.1rem", paddingTop: "0.5rem" }}>
                  {nextPredictedTca}
                </span>
              </div>
            </div>

            {/* Quick Operations Actions */}
            <div className="operations-panel">
              <div className="operations-info font-mono">
                <h3>Consola de Sincronización Espacial</h3>
                {message && <p className="operation-message font-mono">Estatus: {message}</p>}
              </div>
              <div className="operations-buttons">
                <button onClick={handleUpdateData} disabled={loading} className="btn-primary">
                  <Database size={14} />
                  <span>Actualizar TLEs</span>
                </button>
                <button onClick={handleRunScan} disabled={loading} className="btn-secondary">
                  <Zap size={14} />
                  <span>Escanear Proximidad</span>
                </button>
              </div>
            </div>

            {/* Bottom Overview Row: Recent Alerts & Quick Stats */}
            <div className="bottom-charts-grid" style={{ gridTemplateColumns: "1.5fr 1fr", gap: "1rem" }}>
              
              {/* Recent Alerts Feed */}
              <div className="drawer-card">
                <div className="drawer-card-header" style={{ marginBottom: "1rem" }}>
                  <ShieldAlert size={16} className="text-red" />
                  <h3>Alertas de Máxima Prioridad Operativa</h3>
                </div>
                <div className="events-list scrollbar-custom" style={{ maxHeight: "250px" }}>
                  {sortedRecentEvents.length === 0 ? (
                    <div className="empty-state">No hay alertas registradas.</div>
                  ) : (
                    sortedRecentEvents.map((ev) => {
                      const risk = calculateRisk(ev.miss_distance_km);
                      return (
                        <div
                          key={`feed-${ev.id}`}
                          onClick={() => handleRowClick(ev)}
                          className="event-card cursor-pointer"
                          style={{ borderLeft: `3.5px solid ${risk.color}` }}
                        >
                          <div className="event-card-header">
                            <span className="badge-severity font-bold text-xs" style={{ background: risk.badgeColor, color: risk.color, border: `1px solid ${risk.badgeBorder}` }}>
                              {risk.label}
                            </span>
                            <span className="text-xs text-gray-500 font-mono">TCA: {formatDate(ev.tca_utc)}</span>
                          </div>
                          <div className="approaching-entities font-mono">
                            <span className="text-green font-bold">{ev.target_name}</span>
                            <span className="vs text-gray-600 text-xs">vs</span>
                            <span className="text-cyan font-bold">{ev.object_name}</span>
                          </div>
                          <div className="event-metrics" style={{ marginTop: "0.25rem" }}>
                            <div>
                              <span className="lbl">Distancia:</span>
                              <span className="val text-yellow font-bold">{ev.miss_distance_km.toFixed(3)} km</span>
                            </div>
                            <div>
                              <span className="lbl">Velocidad:</span>
                              <span className="val font-mono">{ev.relative_speed_km_s.toFixed(1)} km/s</span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Quick Statistics Widget */}
              <div className="drawer-card">
                <div className="drawer-card-header" style={{ marginBottom: "1.25rem" }}>
                  <Activity size={16} className="text-cyan" />
                  <h3>Estadísticas Rápidas de Amenazas</h3>
                </div>
                <div className="quick-stats-widget font-mono text-xs" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  <div className="stat-progress-row">
                    <div className="stat-progress-lbl">
                      <span>Amenazas Críticas (&lt; 1km):</span>
                      <span className="text-red font-bold">{criticalAlertsCount}</span>
                    </div>
                    <div className="progress-bar-bg">
                      <div
                        className="progress-bar-fill"
                        style={{
                          width: `${events.length > 0 ? (criticalAlertsCount / events.length) * 100 : 0}%`,
                          background: "#FF3B5C"
                        }}
                      ></div>
                    </div>
                  </div>

                  <div className="stat-progress-row">
                    <div className="stat-progress-lbl">
                      <span>Satélites en LEO:</span>
                      <span className="text-green font-bold">
                        {events.filter((e) => e.orbit_regime === "LEO").length}
                      </span>
                    </div>
                    <div className="progress-bar-bg">
                      <div
                        className="progress-bar-fill"
                        style={{
                          width: `${events.length > 0 ? (events.filter((e) => e.orbit_regime === "LEO").length / events.length) * 100 : 0}%`,
                          background: "#00D084"
                        }}
                      ></div>
                    </div>
                  </div>

                  <div className="stat-progress-row">
                    <div className="stat-progress-lbl">
                      <span>Satélites en GEO:</span>
                      <span className="text-yellow font-bold">
                        {events.filter((e) => e.orbit_regime === "GEO").length}
                      </span>
                    </div>
                    <div className="progress-bar-bg">
                      <div
                        className="progress-bar-fill"
                        style={{
                          width: `${events.length > 0 ? (events.filter((e) => e.orbit_regime === "GEO").length / events.length) * 100 : 0}%`,
                          background: "#FFD54A"
                        }}
                      ></div>
                    </div>
                  </div>

                  <div className="total-aggregated-info font-sans text-gray-400" style={{ fontSize: 11, lineHeight: 1.4 }}>
                    El analizador automático mantiene la órbita sincronizada. Las alertas de proximidad se evalúan con algoritmos SGP4 inerciales en tiempo real.
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* TAB 2: EVENTS ADVANCED TABLE */}
        {activeTab === "events" && (
          <div className="dashboard-tab-content scrollbar-custom" style={{ width: "100%" }}>
            <div className="events-table-container">
              
              {/* Header and Multi-Filters Panel */}
              <div className="table-header-row" style={{ flexDirection: "column", gap: "1rem", alignItems: "stretch" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h2>Lista Avanzada de Conjunciones Orbitales</h2>
                  <span className="font-mono text-xs text-gray-500">Filtrados: {filteredEventsForTable.length} eventos</span>
                </div>

                {/* Filter console row */}
                <div className="reports-filters-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.5rem" }}>
                  
                  {/* Global Search Input */}
                  <div className="filter-input-group" style={{ flex: 1.5 }}>
                    <span className="filter-lbl font-mono"><Search size={12} className="inline mr-1" />BUSCADOR:</span>
                    <input
                      type="text"
                      placeholder="Satélite, Objeto, NORAD ID..."
                      value={globalSearch}
                      onChange={(e) => setGlobalSearch(e.target.value)}
                      className="select-filter"
                      style={{ background: "#111827" }}
                    />
                  </div>

                  <div className="filter-input-group">
                    <span className="filter-lbl font-mono"><Calendar size={12} className="inline mr-1" />DESDE:</span>
                    <input
                      type="date"
                      value={eventsFilterDateFrom}
                      onChange={(e) => setEventsFilterDateFrom(e.target.value)}
                      className="select-filter"
                    />
                  </div>

                  <div className="filter-input-group">
                    <span className="filter-lbl font-mono"><Calendar size={12} className="inline mr-1" />HASTA:</span>
                    <input
                      type="date"
                      value={eventsFilterDateTo}
                      onChange={(e) => setEventsFilterDateTo(e.target.value)}
                      className="select-filter"
                    />
                  </div>

                  <div className="filter-input-group">
                    <span className="filter-lbl font-mono">SATÉLITE:</span>
                    <select
                      value={filterSatellite}
                      onChange={(e) => setFilterSatellite(e.target.value)}
                      className="select-filter"
                    >
                      <option value="">Todos</option>
                      {satellites.map((s) => (
                        <option key={`events-opt-${s.norad_id}`} value={s.norad_id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="filter-input-group">
                    <span className="filter-lbl font-mono">RIESGO:</span>
                    <select
                      value={filterSeverity}
                      onChange={(e) => setFilterSeverity(e.target.value)}
                      className="select-filter"
                    >
                      <option value="">Todos</option>
                      <option value="CRITICAL">Critical</option>
                      <option value="HIGH">High</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="LOW">Low</option>
                    </select>
                  </div>

                </div>
              </div>

              {/* Data Table */}
              <div className="table-wrapper">
                <table className="dashboard-table">
                  <thead>
                    <tr>
                      <th>Satélite Objetivo (NORAD)</th>
                      <th>Objeto Amenaza (NORAD)</th>
                      <th>Órbita</th>
                      <th>TCA UTC</th>
                      <th>Distancia Mín.</th>
                      <th>Vel. Relativa</th>
                      <th>Riesgo</th>
                      <th>Tipo</th>
                      <th>Simular</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEventsForTable.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="table-empty">No se registran eventos con los filtros seleccionados.</td>
                      </tr>
                    ) : (
                      filteredEventsForTable.map((ev) => {
                        const risk = calculateRisk(ev.miss_distance_km);
                        return (
                          <tr
                            key={`row-${ev.id}`}
                            onClick={() => handleRowClick(ev)}
                            className={`cursor-pointer ${selectedEventId === ev.id ? "row-selected" : ""}`}
                          >
                            <td className="text-green font-bold">
                              {ev.target_name} <span className="text-gray-500 font-normal">({ev.target_norad})</span>
                            </td>
                            <td className="text-cyan font-bold">
                              {ev.object_name} <span className="text-gray-500 font-normal">({ev.object_norad})</span>
                            </td>
                            <td>
                              <span className="badge-regime font-mono">{ev.orbit_regime}</span>
                            </td>
                            <td className="font-mono text-xs">{formatDate(ev.tca_utc)}</td>
                            <td className="text-yellow font-bold">{ev.miss_distance_km.toFixed(3)} km</td>
                            <td className="font-mono">{ev.relative_speed_km_s.toFixed(1)} km/s</td>
                            <td>
                              <span className="badge-severity font-bold text-xs" style={{ background: risk.badgeColor, color: risk.color, border: `1px solid ${risk.badgeBorder}` }}>
                                {risk.label}
                              </span>
                            </td>
                            <td className="font-mono text-xs text-gray-400">
                              {ev.simulated ? "Simulado" : "Real"}
                            </td>
                            <td onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => handleStartReplay(ev)}
                                className="btn-table-action"
                              >
                                <Zap size={11} />
                                <span>Simular</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

            </div>
          </div>
        )}

        {/* TAB 3: 3D ORBIT VIEW */}
        {activeTab === "3d" && (
          <div className="visualizer-tab-layout" style={{ display: "flex", gap: "1rem", flex: 1, height: "calc(100vh - 140px)", overflow: "hidden", width: "100%" }}>
            
            {/* Main Visualizer (Canvas & HUD) */}
            <div className="visualizer-container" style={{ flex: 1, position: "relative", height: "100%" }}>
            
            {/* Canvas HUD Overlay */}
            <div className="canvas-hud">
              {/* Timeline Controls */}
              <div className="timeline-hud">
                <div className="time-display">
                  <Clock size={16} className="text-cyan" />
                  <span className="time-text font-mono">
                    {currentTime.toISOString().replace("T", " ").substring(0, 19)} UTC
                  </span>
                </div>
                <div className="timeline-btns">
                  <button
                    onClick={() => setIsPaused(!isPaused)}
                    className={`btn-hud ${isPaused ? "active" : ""}`}
                    title={isPaused ? "Play" : "Pause"}
                  >
                    {isPaused ? <Play size={14} /> : <Pause size={14} />}
                  </button>
                  <button
                    onClick={() => setCurrentTime(new Date())}
                    className="btn-hud"
                    title="Restablecer tiempo real"
                  >
                    <RotateCcw size={14} />
                  </button>
                  
                  {/* Speed Multipliers */}
                  <select
                    value={timeMultiplier}
                    onChange={(e) => setTimeMultiplier(Number(e.target.value))}
                    className="select-hud"
                  >
                    <option value={1}>1x (Real)</option>
                    <option value={10}>10x</option>
                    <option value={60}>1 min/s</option>
                    <option value={600}>10 min/s</option>
                    <option value={3600}>1 hora/s</option>
                  </select>
                </div>
              </div>

              {/* Display / Layer Filters Overlay */}
              <div className="layers-hud">
                <button
                  onClick={() => setShowTargets(!showTargets)}
                  className={`btn-hud ${showTargets ? "active" : ""}`}
                >
                  {showTargets ? <Eye size={12} /> : <EyeOff size={12} />}
                  <span>Sats AR</span>
                </button>
                <button
                  onClick={() => setShowCandidates(!showCandidates)}
                  className={`btn-hud ${showCandidates ? "active" : ""}`}
                >
                  {showCandidates ? <Eye size={12} /> : <EyeOff size={12} />}
                  <span>Chatarra</span>
                </button>
                <button
                  onClick={() => setShowLEO(!showLEO)}
                  className={`btn-hud ${showLEO ? "active" : ""}`}
                >
                  {showLEO ? <Eye size={12} /> : <EyeOff size={12} />}
                  <span>LEO</span>
                </button>
                <button
                  onClick={() => setShowGEO(!showGEO)}
                  className={`btn-hud ${showGEO ? "active" : ""}`}
                >
                  {showGEO ? <Eye size={12} /> : <EyeOff size={12} />}
                  <span>GEO</span>
                </button>
              </div>

              {/* Replay HUD Banner */}
              {isReplayMode && replayStartTime && replayTcaTime && (
                <div className="replay-hud-banner">
                  <div className="replay-controls-row">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <div className="pulse-dot red"></div>
                      <div className="replay-text">
                        <span className="font-bold text-red">MODO REPLAY DE APTO</span>
                        <span className="font-mono text-xs ml-2">
                          TCA: {replayTcaTime.toISOString().substring(11, 19)} UTC
                        </span>
                      </div>
                    </div>
                    <button onClick={handleStopReplay} className="btn-exit-replay">
                      Salir
                    </button>
                  </div>
                  
                  {/* Timeline slider for scrubbing forward/backward */}
                  <div className="replay-slider-container">
                    <span className="slider-time-label font-mono">-30m</span>
                    <input
                      type="range"
                      min={0}
                      max={40 * 60 * 1000} // 40 minutes range in milliseconds
                      value={Math.max(0, Math.min(40 * 60 * 1000, currentTime.getTime() - replayStartTime.getTime()))}
                      onChange={(e) => {
                        const newTime = new Date(replayStartTime.getTime() + Number(e.target.value));
                        setCurrentTime(newTime);
                      }}
                      className="replay-slider"
                    />
                    <span className="slider-time-label font-mono">+10m</span>
                  </div>
                </div>
              )}
            </div>

            {/* 3D Scene viewport */}
            <div className="canvas-wrapper">
              <Canvas camera={{ position: [0, 5, 12], fov: 45 }}>
                <color attach="background" args={["#030712"]} />
                <SpaceCamera targetPosition={cameraTarget} />
                
                <Suspense fallback={
                  <mesh>
                    <sphereGeometry args={[EARTH_RADIUS_3D, 64, 64]} />
                    <meshStandardMaterial color="#1d2d50" roughness={0.8} />
                  </mesh>
                }>
                  <EarthScene currentTime={currentTime} />
                </Suspense>
                
                <OrbitLayer
                  satellites={satellites}
                  candidates={candidates}
                  showLEO={showLEO}
                  showGEO={showGEO}
                  showTargets={showTargets}
                  showCandidates={showCandidates}
                  selectedNoradId={selectedSatellite?.norad_id || null}
                  currentTime={currentTime}
                  selectedEventId={selectedEventId}
                  events={events}
                />
                
                <SatelliteLayer
                  satellites={satellites}
                  candidates={candidates}
                  showLEO={showLEO}
                  showGEO={showGEO}
                  showTargets={showTargets}
                  showCandidates={showCandidates}
                  currentTime={currentTime}
                  selectedNoradId={selectedSatellite?.norad_id || null}
                  onSelectSatellite={(sat, pos, tele) => {
                    setSelectedSatellite(sat);
                    setSelectedTelemetry(tele);
                    setCameraTarget(pos);
                  }}
                />
                
                <EventLayer
                  events={events}
                  satellites={satellites}
                  candidates={candidates}
                  currentTime={currentTime}
                  selectedEventId={selectedEventId}
                />
              </Canvas>
            </div>
          </div>

          {/* Right Sidebar: Conjunction Simulations Console */}
          <div className="visualizer-sidebar drawer-card" style={{ width: "380px", flexShrink: 0, height: "100%", display: "flex", flexDirection: "column", background: "rgba(3, 7, 18, 0.65)", backdropFilter: "blur(12px)", borderLeft: "1px solid rgba(255,255,255,0.05)", padding: "1rem", borderRadius: "10px" }}>
              <div className="drawer-card-header" style={{ marginBottom: "0.5rem" }}>
                <Zap size={16} className="text-yellow" />
                <h3>Consola de Simulación</h3>
              </div>
              <p className="text-gray-400" style={{ fontSize: "0.75rem", marginBottom: "1rem", lineHeight: "1.3" }}>
                Seleccione un evento de conjunción para propagar e inspeccionar el acercamiento en el simulador interactivo 3D.
              </p>

              <div className="simulations-list scrollbar-custom" style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "0.75rem", paddingRight: "0.25rem" }}>
                {events.length === 0 ? (
                  <div className="empty-state" style={{ padding: "2rem 1rem" }}>
                    No hay eventos disponibles para simulación.
                  </div>
                ) : (
                  [...events]
                    .sort((a, b) => a.miss_distance_km - b.miss_distance_km) // Prioritize closest encounters
                    .map((ev) => {
                      const risk = calculateRisk(ev.miss_distance_km);
                      return (
                        <div
                          key={`sim-card-${ev.id}`}
                          className="sim-event-card"
                          style={{
                            background: "rgba(255, 255, 255, 0.02)",
                            border: "1px solid rgba(255, 255, 255, 0.05)",
                            borderLeft: `4px solid ${risk.color}`,
                            borderRadius: "6px",
                            padding: "0.75rem",
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.5rem"
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: "0.7rem", color: risk.color, fontWeight: "bold", background: risk.badgeColor, padding: "2px 6px", borderRadius: "3px", border: `1px solid ${risk.badgeBorder}` }}>
                              {risk.label}
                            </span>
                            <span className="font-mono text-gray-500" style={{ fontSize: "0.65rem" }}>
                              {ev.orbit_regime}
                            </span>
                          </div>

                          <div style={{ fontSize: "0.8rem", fontWeight: "bold", fontFamily: "monospace", display: "flex", flexDirection: "column" }}>
                            <span className="text-green">{ev.target_name}</span>
                            <span style={{ fontSize: "0.65rem", color: "rgba(255,255,255,0.3)", margin: "1px 0" }}>vs</span>
                            <span className="text-cyan">{ev.object_name}</span>
                          </div>

                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.7rem", color: "rgba(255,255,255,0.6)", borderTop: "1px solid rgba(255,255,255,0.03)", paddingTop: "4px" }}>
                            <span>Dist: <strong className="text-yellow">{ev.miss_distance_km.toFixed(2)} km</strong></span>
                            <span>TCA: <strong>{new Date(ev.tca_utc).toLocaleTimeString("es-AR", {hour: "2-digit", minute:"2-digit"})}</strong></span>
                          </div>

                          <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem" }}>
                            <button
                              onClick={() => handleStartReplay(ev)}
                              className="btn-primary"
                              style={{
                                flex: 1,
                                padding: "4px 8px",
                                fontSize: "0.7rem",
                                height: "auto",
                                background: `linear-gradient(135deg, ${risk.color}dd, ${risk.color})`,
                                border: "none",
                                boxShadow: `0 0 10px ${risk.color}33`,
                                cursor: "pointer"
                              }}
                            >
                              <Play size={10} style={{ marginRight: "3px" }} />
                              Simular
                            </button>
                            <button
                              onClick={() => handleRowClick(ev)}
                              className="btn-secondary"
                              style={{
                                padding: "4px 8px",
                                fontSize: "0.7rem",
                                height: "auto",
                                cursor: "pointer"
                              }}
                            >
                              Ficha
                            </button>
                          </div>
                        </div>
                      );
                    })
                )}
              </div>
            </div>

          </div>
        )}

        {/* Floating live telemetry side panel in 3D Tab */}
        {activeTab === "3d" && selectedSatellite && (
          <aside className="sidebar-dashboard">
            <div className="panel-hud telemetry-panel">
              <div className="panel-header">
                <h3>TELEMETRÍA EN VIVO</h3>
                <button
                  onClick={() => {
                    setSelectedSatellite(null);
                    setSelectedTelemetry(null);
                    setCameraTarget(null);
                  }}
                  className="btn-close-panel"
                >
                  ×
                </button>
              </div>
              <div className="telemetry-body font-mono">
                <div className="telemetry-row">
                  <span className="lbl">OBJETO:</span>
                  <span className="val text-cyan">{selectedSatellite.name}</span>
                </div>
                <div className="telemetry-row">
                  <span className="lbl">NORAD ID:</span>
                  <span className="val">{selectedSatellite.norad_id}</span>
                </div>
                <div className="telemetry-row">
                  <span className="lbl">ÓRBITA:</span>
                  <span className="val text-yellow">{selectedSatellite.orbit_regime}</span>
                </div>
                {selectedTelemetry && (
                  <>
                    <div className="telemetry-row">
                      <span className="lbl">ALTITUD:</span>
                      <span className="val text-green">{selectedTelemetry.altitude.toFixed(2)} km</span>
                    </div>
                    <div className="telemetry-row">
                      <span className="lbl">VELOCIDAD:</span>
                      <span className="val text-green">{selectedTelemetry.velocity.toFixed(3)} km/s</span>
                    </div>
                  </>
                )}
                {selectedSatellite.raw_json && (
                  <div className="keplerian-subpanel mt-2">
                    <div className="eyebrow-small">ELEMENTOS KEPLERIANOS (OMM)</div>
                    <div className="telemetry-row">
                      <span className="lbl">INCLINACIÓN:</span>
                      <span className="val">{parseFloat(selectedSatellite.raw_json.INCLINATION).toFixed(4)}°</span>
                    </div>
                    <div className="telemetry-row">
                      <span className="lbl">EXCENTRICIDAD:</span>
                      <span className="val">{parseFloat(selectedSatellite.raw_json.ECCENTRICITY).toFixed(6)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </aside>
        )}

        {/* TAB 4: ANALYTICS */}
        {activeTab === "analytics" && (
          <div style={{ width: "100%" }}>
            <AnalyticsView events={events} satellites={satellites} />
          </div>
        )}

        {/* TAB 5: REPORTS */}
        {activeTab === "reports" && (
          <div style={{ width: "100%" }}>
            <ReportsView events={events} satellites={satellites} onSimulate={handleStartReplay} />
          </div>
        )}

      </div>

      {/* Main Drawer details for events */}
      <EventDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        event={selectedEventForDrawer}
        satellites={satellites}
        candidates={candidates}
      />

      {/* Technical Warning Footer */}
      <footer className="disclaimer-footer">
        <div className="disclaimer-content">
          <Info size={14} className="text-yellow" />
          <p>
            <strong>AVISO OPERACIONAL IMPORTANTE:</strong> Novarys Space detecta eventos estimados de proximidad orbital
            utilizando datos públicos y propagación SGP4. No reemplaza análisis operacionales oficiales de seguridad espacial.
            <button onClick={() => setShowWarningModal(true)} className="btn-text-info">
              Ver limitaciones técnicas
            </button>
          </p>
        </div>
      </footer>

      {/* Technical Limitations Modal */}
      {showWarningModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>LIMITACIONES TÉCNICAS DE MONITOREO SSA</h2>
              <button onClick={() => setShowWarningModal(false)} className="btn-close-modal">
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>
                Los análisis y simulaciones presentados en esta interfaz representan estimaciones geométricas de
                trayectorias orbitales y no confirman la posibilidad absoluta de colisiones físicas reales.
              </p>
              <h3>Ausencia de Datos de Alta Precisión</h3>
              <p>
                El sistema carece de las siguientes variables indispensables para la planificación de maniobras oficiales
                de evitación de colisiones (CAM):
              </p>
              <ul>
                <li><strong>Covarianzas orbitales:</strong> Incertidumbre estadística asociada a la medición de posiciones.</li>
                <li><strong>Mensajes de Datos de Conjunción (CDM) oficiales:</strong> Enviados por organismos gubernamentales (como el 18th Space Defense Squadron de EE. UU.).</li>
                <li><strong>Incertidumbre de trayectoria:</strong> Variaciones producidas por arrastre atmosférico, presión de radiación solar y asimetría gravitacional terrestre.</li>
                <li><strong>Información dimensional:</strong> Geometría física exacta, masas y áreas de sección transversal de los objetos.</li>
              </ul>
              <div className="alert-box-warning">
                Existe una aproximación orbital estimada que requiere revisión humana y contraste con fuentes primarias.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
