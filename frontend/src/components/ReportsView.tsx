import React, { useState, useMemo } from "react";
import { FileText, Download, Share2, Printer, Filter, Calendar, Zap, AlertTriangle, ShieldCheck } from "lucide-react";
import type { ProximityEvent, Satellite } from "../types";
import { calculateRisk } from "../utils/calculateRisk";

interface ReportsViewProps {
  events: ProximityEvent[];
  satellites: Satellite[];
  onSimulate: (event: ProximityEvent) => void;
}

export function ReportsView({ events, satellites, onSimulate }: ReportsViewProps) {
  // Filter states
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedSat, setSelectedSat] = useState("");
  const [selectedSeverity, setSelectedSeverity] = useState("");
  const [selectedRegime, setSelectedRegime] = useState("");
  
  // Generated flag to trigger preview display
  const [isGenerated, setIsGenerated] = useState(true);

  // Compute filtered list based on report filters
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      const risk = calculateRisk(ev.miss_distance_km);
      
      // Date filters
      if (dateFrom) {
        const fromTime = new Date(dateFrom).getTime();
        const evTime = new Date(ev.tca_utc).getTime();
        if (evTime < fromTime) return false;
      }
      if (dateTo) {
        const toTime = new Date(dateTo).getTime();
        const evTime = new Date(ev.tca_utc).getTime();
        if (evTime > toTime) return false;
      }
      
      // Sat filter
      if (selectedSat && ev.target_norad.toString() !== selectedSat) return false;
      
      // Severity filter
      if (selectedSeverity && risk.label !== selectedSeverity) return false;
      
      // Regime filter
      if (selectedRegime && ev.orbit_regime !== selectedRegime) return false;

      return true;
    });
  }, [events, dateFrom, dateTo, selectedSat, selectedSeverity, selectedRegime]);

  // Operational metrics for the summary
  const summaryMetrics = useMemo(() => {
    if (filteredEvents.length === 0) {
      return {
        total: 0,
        critical: 0,
        avgRiskLabel: "LOW",
        minDistance: 0
      };
    }

    let criticalCount = 0;
    let minDistance = filteredEvents[0].miss_distance_km;
    let sumPriority = 0;

    filteredEvents.forEach((ev) => {
      const risk = calculateRisk(ev.miss_distance_km);
      if (risk.label === "CRITICAL") criticalCount++;
      if (ev.miss_distance_km < minDistance) minDistance = ev.miss_distance_km;
      sumPriority += risk.priority;
    });

    const avgPriority = Math.round(sumPriority / filteredEvents.length);
    let avgRiskLabel = "LOW";
    if (avgPriority === 1) avgRiskLabel = "CRITICAL";
    else if (avgPriority === 2) avgRiskLabel = "HIGH";
    else if (avgPriority === 3) avgRiskLabel = "MEDIUM";

    return {
      total: filteredEvents.length,
      critical: criticalCount,
      avgRiskLabel,
      minDistance
    };
  }, [filteredEvents]);

  // Real CSV Exporter
  const handleExportCsv = () => {
    if (filteredEvents.length === 0) {
      alert("No hay eventos filtrados para exportar.");
      return;
    }
    const headers = ["ID", "Satellite Target", "NORAD Target", "Close Object", "NORAD Object", "Orbit", "TCA UTC", "Miss Distance (km)", "Velocity Relative (km/s)", "Severity"];
    const rows = filteredEvents.map((ev) => [
      ev.id,
      ev.target_name,
      ev.target_norad,
      ev.object_name,
      ev.object_norad,
      ev.orbit_regime,
      ev.tca_utc,
      ev.miss_distance_km.toFixed(3),
      ev.relative_speed_km_s.toFixed(1),
      calculateRisk(ev.miss_distance_km).label
    ]);

    const csvContent = "data:text/csv;charset=utf-8,"
      + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `novarys_orbital_conjunctions_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportPdf = () => {
    alert("Exportando reporte oficial en formato PDF de Misión SSA... (Simulado)");
  };

  const handleShareSnapshot = () => {
    alert("Compartiendo enlace temporal de telemetría con CONAE y NASA... (Enlace copiado al portapapeles)");
  };

  const handleGenerateReport = () => {
    setIsGenerated(true);
  };

  return (
    <div className="reports-view-container">
      
      {/* Filters Console Card */}
      <div className="drawer-card reports-filters-card">
        <div className="drawer-card-header">
          <Filter size={16} className="text-cyan" />
          <h3>Consola de Filtros de Generación</h3>
        </div>
        
        <div className="reports-filters-grid">
          <div className="filter-input-group">
            <span className="filter-lbl font-mono">DESDE:</span>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="select-filter" />
          </div>
          
          <div className="filter-input-group">
            <span className="filter-lbl font-mono">HASTA:</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="select-filter" />
          </div>

          <div className="filter-input-group">
            <span className="filter-lbl font-mono">SATÉLITE:</span>
            <select value={selectedSat} onChange={(e) => setSelectedSat(e.target.value)} className="select-filter">
              <option value="">Todos</option>
              {satellites.map((s) => (
                <option key={`opt-rep-${s.norad_id}`} value={s.norad_id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div className="filter-input-group">
            <span className="filter-lbl font-mono">SEVERIDAD:</span>
            <select value={selectedSeverity} onChange={(e) => setSelectedSeverity(e.target.value)} className="select-filter">
              <option value="">Todas</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          <div className="filter-input-group">
            <span className="filter-lbl font-mono">ÓRBITA:</span>
            <select value={selectedRegime} onChange={(e) => setSelectedRegime(e.target.value)} className="select-filter">
              <option value="">Todas</option>
              <option value="LEO">LEO</option>
              <option value="GEO">GEO</option>
            </select>
          </div>
        </div>

        <div className="reports-actions-row">
          <button onClick={handleGenerateReport} className="btn-primary">
            <FileText size={14} />
            <span>Generar Reporte</span>
          </button>
          
          <div className="export-buttons-group">
            <button onClick={handleExportPdf} className="btn-secondary">
              <Printer size={14} />
              <span>Exportar PDF</span>
            </button>
            <button onClick={handleExportCsv} className="btn-secondary">
              <Download size={14} />
              <span>Exportar CSV</span>
            </button>
            <button onClick={handleShareSnapshot} className="btn-secondary">
              <Share2 size={14} />
              <span>Compartir Snapshot</span>
            </button>
          </div>
        </div>
      </div>

      {/* Report Preview Panel */}
      {isGenerated && (
        <div className="drawer-card report-preview-card">
          <div className="report-preview-header">
            <div className="mission-title-box">
              <div className="logo-badge" style={{ background: "rgba(6, 182, 212, 0.1)", color: "#06b6d4", borderColor: "rgba(6, 182, 212, 0.3)" }}>
                NOVARYS REPORT
              </div>
              <h2>Informe Operacional de Situación Espacial (SSA)</h2>
              <span className="font-mono text-xs text-gray-500">
                GENERADO: {new Date().toISOString().replace("T", " ").substring(0, 19)} UTC
              </span>
            </div>
          </div>

          {/* Quick Metrics Bar inside Preview */}
          <div className="report-preview-metrics font-mono">
            <div className="metric-box">
              <span className="lbl text-gray-400">EVENTOS FILTRADOS:</span>
              <span className="val text-cyan font-bold">{summaryMetrics.total}</span>
            </div>
            <div className="metric-box">
              <span className="lbl text-gray-400">AMENAZAS CRÍTICAS:</span>
              <span className="val text-red font-bold">{summaryMetrics.critical}</span>
            </div>
            <div className="metric-box">
              <span className="lbl text-gray-400">RIESGO GENERAL DE FLOTA:</span>
              <span className="val text-yellow font-bold">{summaryMetrics.avgRiskLabel}</span>
            </div>
            <div className="metric-box">
              <span className="lbl text-gray-400">DISTANCIA MÍNIMA REGISTRADA:</span>
              <span className="val text-green font-bold">{summaryMetrics.minDistance.toFixed(3)} km</span>
            </div>
          </div>

          {/* Executive Summary */}
          <div className="report-executive-summary font-sans mt-4">
            <h4 className="text-cyan font-mono text-xs font-bold uppercase mb-1">Resumen Ejecutivo de Seguridad Espacial</h4>
            <p className="text-gray-400 text-xs leading-relaxed">
              El Centro de Operaciones SSA de Novarys Space ha completado el análisis de aproximación orbital. 
              Se han detectado un total de {summaryMetrics.total} eventos de aproximación que entran dentro del rango configurado. 
              {summaryMetrics.critical > 0 ? (
                <span className="text-red font-bold"> IMPORTANTE: Se registran {summaryMetrics.critical} conjunciones con rango de severidad CRITICAL (menor a 1.0 km) que requieren maniobras de mitigación urgentes.</span>
              ) : (
                <span className="text-green"> Actualmente la flota se encuentra en condiciones nominales de navegación espacial sin riesgos críticos activos en el rango filtrado.</span>
              )}
            </p>
          </div>

          {/* Preview Table */}
          <div className="table-wrapper mt-4">
            <table className="dashboard-table preview-report-table">
              <thead>
                <tr>
                  <th>Satélite Objetivo</th>
                  <th>Objeto Cercano</th>
                  <th>TCA UTC</th>
                  <th>Distancia Mín.</th>
                  <th>Velocidad</th>
                  <th>Severidad</th>
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="table-empty">No se encontraron conjunciones bajo los filtros seleccionados.</td>
                  </tr>
                ) : (
                  filteredEvents.map((ev) => {
                    const risk = calculateRisk(ev.miss_distance_km);
                    return (
                      <tr key={`prev-row-${ev.id}`}>
                        <td className="text-green font-bold">{ev.target_name}</td>
                        <td className="text-cyan font-bold">{ev.object_name}</td>
                        <td className="font-mono text-xs">{ev.tca_utc.replace("T", " ").replace("+00:00", "")}</td>
                        <td className="text-yellow font-bold">{ev.miss_distance_km.toFixed(3)} km</td>
                        <td className="font-mono">{ev.relative_speed_km_s.toFixed(1)} km/s</td>
                        <td>
                          <span className="font-bold" style={{ color: risk.color }}>{risk.label}</span>
                        </td>
                        <td>
                          <button
                            onClick={() => onSimulate(ev)}
                            className="btn-table-action"
                            style={{ padding: "0.15rem 0.45rem", fontSize: 9 }}
                          >
                            <Zap size={10} />
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
      )}

    </div>
  );
}
