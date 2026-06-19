import React, { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  Legend
} from "recharts";
import { Activity, ShieldAlert, TrendingUp, BarChart3, Info, Calendar } from "lucide-react";
import type { ProximityEvent, Satellite } from "../types";
import { calculateRisk } from "../utils/calculateRisk";

interface AnalyticsViewProps {
  events: ProximityEvent[];
  satellites: Satellite[];
}

export function AnalyticsView({ events, satellites }: AnalyticsViewProps) {
  const [period, setPeriod] = useState<"day" | "month">("day");

  // 1. Dynamic Risk Distribution (Donut Chart)
  const riskDistributionData = useMemo(() => {
    const counts = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    events.forEach((ev) => {
      const risk = calculateRisk(ev.miss_distance_km);
      counts[risk.label] += 1;
    });

    return [
      { name: "CRITICAL", value: counts.CRITICAL, color: "#FF3B5C" },
      { name: "HIGH", value: counts.HIGH, color: "#FF8A00" },
      { name: "MEDIUM", value: counts.MEDIUM, color: "#FFD54A" },
      { name: "LOW", value: counts.LOW, color: "#00D084" }
    ].filter((item) => item.value > 0 || events.length === 0);
  }, [events]);

  // Total count for percentage calculations
  const totalEventsCount = events.length;

  // 2. Alerts by Argentine Satellites (Bar Chart)
  const satExposureData = useMemo(() => {
    const counts: Record<string, number> = {};
    // Seed with common AR satellites to ensure they appear
    const arSats = ["SAOCOM-1A", "SAOCOM-1B", "ARSAT-1", "ARSAT-2"];
    arSats.forEach(name => { counts[name] = 0; });

    events.forEach((ev) => {
      // Find matching name or default
      const key = ev.target_name.toUpperCase();
      let matched = "Otros";
      if (key.includes("SAOCOM-1A")) matched = "SAOCOM-1A";
      else if (key.includes("SAOCOM-1B")) matched = "SAOCOM-1B";
      else if (key.includes("ARSAT-1")) matched = "ARSAT-1";
      else if (key.includes("ARSAT-2")) matched = "ARSAT-2";
      else matched = ev.target_name;

      counts[matched] = (counts[matched] || 0) + 1;
    });

    return Object.keys(counts).map((name) => ({
      name,
      Alertas: counts[name]
    })).sort((a, b) => b.Alertas - a.Alertas);
  }, [events]);

  // 3. Temporal evolution (Line Chart)
  const temporalData = useMemo(() => {
    const counts: Record<string, number> = {};
    
    events.forEach((ev) => {
      const date = new Date(ev.tca_utc);
      let key = "";
      if (period === "day") {
        key = date.toISOString().substring(0, 10); // YYYY-MM-DD
      } else {
        key = date.toISOString().substring(0, 7); // YYYY-MM
      }
      counts[key] = (counts[key] || 0) + 1;
    });

    return Object.keys(counts)
      .map((dateStr) => ({
        Fecha: dateStr,
        Alertas: counts[dateStr]
      }))
      .sort((a, b) => a.Fecha.localeCompare(b.Fecha));
  }, [events, period]);

  // 4. Intelligent Exposure Sidebar calculations
  const intelligencePanel = useMemo(() => {
    if (events.length === 0) {
      return {
        mostExposedSat: "Ninguno",
        avgRiskLabel: "LOW",
        avgRiskColor: "#00D084",
        closestEvent: null,
        nextTca: "N/D"
      };
    }

    // Find most exposed satellite
    const exposures: Record<string, number> = {};
    events.forEach(ev => {
      exposures[ev.target_name] = (exposures[ev.target_name] || 0) + 1;
    });
    let mostExposedSat = "";
    let maxCount = -1;
    Object.keys(exposures).forEach(sat => {
      if (exposures[sat] > maxCount) {
        maxCount = exposures[sat];
        mostExposedSat = sat;
      }
    });

    // Find closest event (smallest miss distance)
    let closestEvent = events[0];
    events.forEach(ev => {
      if (ev.miss_distance_km < closestEvent.miss_distance_km) {
        closestEvent = ev;
      }
    });

    // Average risk calculation based on priority values
    let sumPriority = 0;
    events.forEach(ev => {
      sumPriority += calculateRisk(ev.miss_distance_km).priority;
    });
    const avgPriority = Math.round(sumPriority / events.length);
    let avgRiskLabel = "LOW";
    let avgRiskColor = "#00D084";
    if (avgPriority === 1) { avgRiskLabel = "CRITICAL"; avgRiskColor = "#FF3B5C"; }
    else if (avgPriority === 2) { avgRiskLabel = "HIGH"; avgRiskColor = "#FF8A00"; }
    else if (avgPriority === 3) { avgRiskLabel = "MEDIUM"; avgRiskColor = "#FFD54A"; }

    // Next TCA in future
    const now = new Date();
    const futureEvents = events
      .filter(ev => new Date(ev.tca_utc) > now)
      .sort((a, b) => new Date(a.tca_utc).getTime() - new Date(b.tca_utc).getTime());
    
    let nextTca = "N/D";
    if (futureEvents.length > 0) {
      nextTca = new Date(futureEvents[0].tca_utc).toISOString().replace("T", " ").substring(0, 19) + " UTC";
    }

    return {
      mostExposedSat,
      avgRiskLabel,
      avgRiskColor,
      closestEvent,
      nextTca
    };
  }, [events]);

  return (
    <div className="analytics-view-container">
      
      {/* 2-Column Responsive Grid */}
      <div className="analytics-grid">
        
        {/* Left Side Charts Column */}
        <div className="charts-column">
          
          {/* Chart 1: Temporal Evolution */}
          <div className="drawer-card chart-card">
            <div className="chart-header">
              <div className="drawer-card-header">
                <TrendingUp size={16} className="text-cyan" />
                <h3>Evolución Temporal de Alertas</h3>
              </div>
              <div className="period-selector">
                <button
                  className={`btn-hud text-xs ${period === "day" ? "active" : ""}`}
                  onClick={() => setPeriod("day")}
                >
                  Diario
                </button>
                <button
                  className={`btn-hud text-xs ${period === "month" ? "active" : ""}`}
                  onClick={() => setPeriod("month")}
                >
                  Mensual
                </button>
              </div>
            </div>
            
            <div style={{ width: "100%", height: 220, marginTop: "1rem" }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={temporalData} margin={{ left: -10, right: 10, top: 10, bottom: 5 }}>
                  <XAxis dataKey="Fecha" stroke="#6b7280" style={{ fontSize: 10 }} />
                  <YAxis stroke="#6b7280" style={{ fontSize: 10 }} />
                  <Tooltip
                    contentStyle={{ background: "#111827", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6 }}
                    labelStyle={{ color: "#9ca3af", fontFamily: "monospace" }}
                  />
                  <Line type="monotone" dataKey="Alertas" stroke="#06b6d4" strokeWidth={2.5} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bottom Grid for Pie and Bar charts */}
          <div className="bottom-charts-grid">
            
            {/* Chart 2: Risk Donut Chart */}
            <div className="drawer-card chart-card">
              <div className="drawer-card-header">
                <ShieldAlert size={16} className="text-yellow" />
                <h3>Distribución de Riesgos</h3>
              </div>
              <div style={{ width: "100%", height: 160, display: "flex", alignItems: "center" }}>
                <div style={{ width: "50%", height: "100%" }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={riskDistributionData}
                        innerRadius={45}
                        outerRadius={65}
                        paddingAngle={4}
                        dataKey="value"
                      >
                        {riskDistributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: "#111827", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                {/* Custom Legends */}
                <div style={{ width: "50%", display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: 11 }}>
                  {riskDistributionData.map((entry, idx) => {
                    const percentage = totalEventsCount > 0 ? ((entry.value / totalEventsCount) * 100).toFixed(0) : 0;
                    return (
                      <div key={idx} style={{ display: "flex", alignItems: "center", justifyItems: "center", gap: 6 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: entry.color }}></div>
                        <span style={{ color: "#9ca3af" }}>{entry.name}:</span>
                        <span className="font-bold text-white">{entry.value} ({percentage}%)</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Chart 3: Alerts by Satellite Bar Chart */}
            <div className="drawer-card chart-card">
              <div className="drawer-card-header">
                <BarChart3 size={16} className="text-green" />
                <h3>Alertas por Satélite Objetivo</h3>
              </div>
              <div style={{ width: "100%", height: 160, marginTop: "0.5rem" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={satExposureData.slice(0, 5)} margin={{ left: -15, right: 10, top: 10, bottom: 5 }}>
                    <XAxis dataKey="name" stroke="#6b7280" style={{ fontSize: 9 }} />
                    <YAxis stroke="#6b7280" style={{ fontSize: 9 }} />
                    <Tooltip
                      contentStyle={{ background: "#111827", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6 }}
                    />
                    <Bar dataKey="Alertas" fill="#00D084" radius={[4, 4, 0, 0]}>
                      {satExposureData.slice(0, 5).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? "#FF3B5C" : index === 1 ? "#FF8A00" : "#00D084"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

        </div>

        {/* Right Side Intelligent Panel Sidebar */}
        <div className="sidebar-column">
          <div className="drawer-card info-card" style={{ height: "100%" }}>
            <div className="drawer-card-header" style={{ marginBottom: "1.25rem" }}>
              <Info size={18} className="text-cyan" />
              <h3>Panel de Inteligencia Orbital</h3>
            </div>
            
            <div className="intelligence-body font-mono">
              
              <div className="intel-row">
                <span className="lbl text-gray-400">SATÉLITE MÁS EXPUESTO:</span>
                <span className="val text-red font-bold text-sm">{intelligencePanel.mostExposedSat}</span>
              </div>

              <div className="intel-row">
                <span className="lbl text-gray-400">RIESGO PROMEDIO DE FLOTA:</span>
                <span className="val font-bold" style={{ color: intelligencePanel.avgRiskColor }}>
                  {intelligencePanel.avgRiskLabel}
                </span>
              </div>

              <div className="intel-row">
                <span className="lbl text-gray-400">PRÓXIMA APROXIMACIÓN (TCA):</span>
                <span className="val text-yellow text-xs">{intelligencePanel.nextTca}</span>
              </div>

              {intelligencePanel.closestEvent && (
                <div className="closest-event-subbox mt-4">
                  <div className="eyebrow-small text-cyan">APROXIMACIÓN MÁS CRÍTICA</div>
                  <div className="intel-subrow">
                    <span className="lbl">Objetivo:</span>
                    <span className="val text-white">{intelligencePanel.closestEvent.target_name}</span>
                  </div>
                  <div className="intel-subrow">
                    <span className="lbl">Amenaza:</span>
                    <span className="val text-white">{intelligencePanel.closestEvent.object_name}</span>
                  </div>
                  <div className="intel-subrow">
                    <span className="lbl">Distancia Mínima:</span>
                    <span className="val text-red font-bold">
                      {intelligencePanel.closestEvent.miss_distance_km.toFixed(3)} km
                    </span>
                  </div>
                  <div className="intel-subrow">
                    <span className="lbl">Velocidad Relativa:</span>
                    <span className="val font-mono">
                      {intelligencePanel.closestEvent.relative_speed_km_s.toFixed(2)} km/s
                    </span>
                  </div>
                </div>
              )}

              <div className="intel-safety-disclaimer mt-4 text-xs text-gray-500 font-sans">
                <Calendar size={14} className="inline mr-1 text-gray-400" />
                Los cálculos analíticos son automáticos y se actualizan dinámicamente con las pasadas orbitales cargadas.
              </div>

            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
