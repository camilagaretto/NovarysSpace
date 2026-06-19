import React from "react";
import { X, ShieldAlert, ShieldCheck, AlertTriangle, Activity, Globe, Compass, Cpu, Zap, Clock } from "lucide-react";
import type { ProximityEvent, Satellite } from "../types";
import { calculateRisk } from "../utils/calculateRisk";

interface EventDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  event: ProximityEvent | null;
  satellites: Satellite[];
  candidates: Satellite[];
}

export function EventDrawer({ isOpen, onClose, event, satellites, candidates }: EventDrawerProps) {
  if (!isOpen || !event) return null;

  // Calculate dynamic risk details using frontend logic
  const risk = calculateRisk(event.miss_distance_km);

  // Find associated full satellite objects from raw_json parameters
  const targetSat = satellites.find((s) => s.norad_id === event.target_norad);
  const objectSat = candidates.find((c) => c.norad_id === event.object_norad);

  // IA Explanation text based on severity
  const getAiExplanation = () => {
    const dist = event.miss_distance_km.toFixed(3);
    const speed = event.relative_speed_km_s.toFixed(2);
    if (risk.label === "CRITICAL") {
      return `ANALISIS DE IA: El sistema clasificó este evento como CRITICAL debido a una distancia de aproximación extrema de ${dist} km (umbral menor a 1 km) y una velocidad de convergencia relativa de ${speed} km/s. Se recomienda el diseño inmediato de una maniobra de evitación de colisión (CAM) y alertar al centro de operaciones terrestres.`;
    } else if (risk.label === "HIGH") {
      return `ANALISIS DE IA: El sistema clasificó este evento como HIGH debido a una distancia mínima estimada de ${dist} km (dentro del rango de seguridad de 1-5 km) y una velocidad relativa de ${speed} km/s. Se recomienda el monitoreo prioritario del evento en cada pasada de telemetry y pre-cálculo de maniobra.`;
    } else if (risk.label === "MEDIUM") {
      return `ANALISIS DE IA: El sistema clasificó este evento como MEDIUM con una aproximación de ${dist} km. No presenta un riesgo de colisión física inminente, pero se aconseja actualizar los elementos TLE/OMM en las próximas 6 horas para descartar precesión orbital acelerada.`;
    } else {
      return `ANALISIS DE IA: El sistema clasificó este evento como LOW. La distancia mínima de aproximación es de ${dist} km, lo cual se encuentra holgadamente dentro de los límites nominales de seguridad operativa. No se requieren acciones mitigadoras.`;
    }
  };

  // Safe parsing helper for JSON fields
  const getKeplerianValue = (sat: Satellite | undefined, field: string, decimals = 4) => {
    if (!sat?.raw_json || sat.raw_json[field] === undefined) return "N/D";
    const val = parseFloat(sat.raw_json[field]);
    return isNaN(val) ? sat.raw_json[field] : val.toFixed(decimals);
  };

  return (
    <div className={`event-drawer-overlay ${isOpen ? "open" : ""}`} onClick={onClose}>
      <div className="event-drawer-content" onClick={(e) => e.stopPropagation()}>
        
        {/* Drawer Header */}
        <div className="drawer-header-section" style={{ borderLeft: `4px solid ${risk.color}` }}>
          <div>
            <div className="logo-badge" style={{ background: risk.badgeColor, color: risk.color, borderColor: risk.badgeBorder }}>
              {risk.label}
            </div>
            <h2>Análisis de Conjunción Orbital</h2>
            <p className="drawer-subtitle font-mono">EVENT ID: #{event.id} • TCA: {event.tca_utc.substring(11, 19)} UTC</p>
          </div>
          <button className="btn-close-drawer" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="drawer-scroll-body scrollbar-custom">
          
          {/* SECTION 1: Target Satellite Info */}
          <div className="drawer-card">
            <div className="drawer-card-header">
              <Cpu size={16} className="text-green" />
              <h3>Satélite Objetivo (Activo Argentino)</h3>
            </div>
            <div className="drawer-grid">
              <div className="grid-item">
                <span className="lbl">Nombre:</span>
                <span className="val text-green font-bold">{event.target_name}</span>
              </div>
              <div className="grid-item">
                <span className="lbl">NORAD ID:</span>
                <span className="val font-mono">{event.target_norad}</span>
              </div>
              <div className="grid-item">
                <span className="lbl">Operador:</span>
                <span className="val">{targetSat?.raw_json?.OPERATOR || "CONAE"}</span>
              </div>
              <div className="grid-item">
                <span className="lbl">País:</span>
                <span className="val">Argentina</span>
              </div>
              <div className="grid-item">
                <span className="lbl">Órbita:</span>
                <span className="val badge-regime font-mono">{event.orbit_regime}</span>
              </div>
              <div className="grid-item">
                <span className="lbl">Inclinación:</span>
                <span className="val font-mono">{getKeplerianValue(targetSat, "INCLINATION")}°</span>
              </div>
              <div className="grid-item">
                <span className="lbl">Excentricidad:</span>
                <span className="val font-mono">{getKeplerianValue(targetSat, "ECCENTRICITY", 6)}</span>
              </div>
              <div className="grid-item">
                <span className="lbl">Inclinación Perigeo:</span>
                <span className="val font-mono">{getKeplerianValue(targetSat, "ARG_OF_PERICENTER")}°</span>
              </div>
            </div>
          </div>

          {/* SECTION 2: Interacting Object Info */}
          <div className="drawer-card">
            <div className="drawer-card-header">
              <Compass size={16} className="text-cyan" />
              <h3>Objeto Involucrado / Amenaza</h3>
            </div>
            <div className="drawer-grid">
              <div className="grid-item">
                <span className="lbl">Nombre:</span>
                <span className="val text-cyan font-bold">{event.object_name}</span>
              </div>
              <div className="grid-item">
                <span className="lbl">NORAD ID:</span>
                <span className="val font-mono">{event.object_norad}</span>
              </div>
              <div className="grid-item">
                <span className="lbl">Tipo:</span>
                <span className="val text-yellow">
                  {event.object_name.includes("DEB") || event.object_name.includes("DEBRIS")
                    ? "Basura Espacial (Debris)"
                    : event.object_name.includes("R/B")
                    ? "Etapa de Cohete (Rocket Body)"
                    : "Satélite Activo"}
                </span>
              </div>
              <div className="grid-item">
                <span className="lbl">Origen / País:</span>
                <span className="val">{objectSat?.raw_json?.COUNTRY || "Desconocido / Global"}</span>
              </div>
              <div className="grid-item">
                <span className="lbl">Operador original:</span>
                <span className="val">{objectSat?.raw_json?.OPERATOR || "N/D"}</span>
              </div>
              <div className="grid-item">
                <span className="lbl">Régimen Orbital:</span>
                <span className="val badge-regime font-mono">{event.orbit_regime}</span>
              </div>
            </div>
          </div>

          {/* SECTION 3: Risk Analysis Metrics */}
          <div className="drawer-card" style={{ borderColor: `rgba(${risk.label === 'CRITICAL' ? '255, 59, 92' : '255, 138, 0'}, 0.25)` }}>
            <div className="drawer-card-header">
              <ShieldAlert size={16} style={{ color: risk.color }} />
              <h3>Métricas de Riesgo del Evento</h3>
            </div>
            <div className="drawer-grid">
              <div className="grid-item">
                <span className="lbl">Distancia Mínima:</span>
                <span className="val font-bold text-yellow" style={{ fontSize: "1.05rem" }}>
                  {event.miss_distance_km.toFixed(3)} km
                </span>
              </div>
              <div className="grid-item">
                <span className="lbl">Velocidad Relativa:</span>
                <span className="val font-mono font-bold">
                  {event.relative_speed_km_s.toFixed(2)} km/s
                </span>
              </div>
              <div className="grid-item">
                <span className="lbl">Hora del TCA:</span>
                <span className="val text-gray-300 font-mono text-xs">
                  {event.tca_utc.replace("T", " ").replace("+00:00", "")} UTC
                </span>
              </div>
              <div className="grid-item">
                <span className="lbl">Severidad Clasificada:</span>
                <span className="val font-bold" style={{ color: risk.color }}>
                  {risk.label}
                </span>
              </div>
            </div>
          </div>

          {/* SECTION 4: AI Intelligent Explanation */}
          <div className="drawer-card ai-explanation-card">
            <div className="drawer-card-header">
              <Zap size={16} className="text-cyan" />
              <h3>Asistente IA de Seguridad Espacial</h3>
            </div>
            <p className="ai-explanation-text font-mono">
              {getAiExplanation()}
            </p>
          </div>

          {/* SECTION 5: Interactive Visual Timeline */}
          <div className="drawer-card">
            <div className="drawer-card-header">
              <Clock size={16} className="text-yellow" />
              <h3>Línea Temporal Estimada (Timeline)</h3>
            </div>
            <div className="timeline-visual">
              <div className="timeline-node completed">
                <div className="node-dot"></div>
                <span className="node-lbl">Detección</span>
                <span className="node-time font-mono">-24h</span>
              </div>
              <div className="timeline-node active">
                <div className="node-dot"></div>
                <span className="node-lbl">Aproximación</span>
                <span className="node-time font-mono">-10m</span>
              </div>
              <div className="timeline-node highlight" style={{ '--node-color': risk.color } as React.CSSProperties}>
                <div className="node-dot"></div>
                <span className="node-lbl" style={{ color: risk.color }}>TCA (Máx)</span>
                <span className="node-time font-mono">00:00</span>
              </div>
              <div className="timeline-node">
                <div className="node-dot"></div>
                <span className="node-lbl">Resolución</span>
                <span className="node-time font-mono">+10m</span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
