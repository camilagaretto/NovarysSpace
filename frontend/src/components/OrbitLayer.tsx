import { useMemo } from "react";
import { Line } from "@react-three/drei";
import { getOrbitPath } from "../services/orbital";
import { calculateRisk } from "../utils/calculateRisk";
import type { Satellite, ProximityEvent } from "../types";

interface OrbitPathProps {
  rawJson: any;
  color: string;
  opacity?: number;
  lineWidth?: number;
  currentTime?: Date;
}

function OrbitPath({ rawJson, color, opacity = 0.35, lineWidth = 1, currentTime }: OrbitPathProps) {
  const points = useMemo(() => {
    // Generate paths using the provided currentTime to align with real-time propagation,
    // or fall back to the satellite's epoch for background/cached orbits.
    const refDate = currentTime || new Date(rawJson.EPOCH);
    const pathCoords = getOrbitPath(rawJson, refDate, 120);
    return pathCoords;
  }, [rawJson, currentTime]);

  if (points.length === 0) return null;

  return (
    <Line
      points={points}
      color={color}
      lineWidth={lineWidth}
      transparent
      opacity={opacity}
    />
  );
}

interface OrbitLayerProps {
  satellites: Satellite[];
  candidates: Satellite[];
  showLEO: boolean;
  showGEO: boolean;
  showTargets: boolean;
  showCandidates: boolean;
  selectedNoradId: number | null;
  currentTime: Date;
  selectedEventId: number | null;
  events: ProximityEvent[];
}

export function OrbitLayer({
  satellites,
  candidates,
  showLEO,
  showGEO,
  showTargets,
  showCandidates,
  selectedNoradId,
  currentTime,
  selectedEventId,
  events,
}: OrbitLayerProps) {
  const selectedSat = useMemo(() => {
    if (!selectedNoradId) return null;
    return (
      satellites.find((s) => s.norad_id === selectedNoradId) ||
      candidates.find((c) => c.norad_id === selectedNoradId) ||
      null
    );
  }, [selectedNoradId, satellites, candidates]);

  const activeEvent = useMemo(() => {
    if (!selectedEventId) return null;
    return events.find((e) => e.id === selectedEventId) || null;
  }, [events, selectedEventId]);

  const eventSats = useMemo(() => {
    if (!activeEvent) return null;
    const target = satellites.find((s) => s.norad_id === activeEvent.target_norad);
    const object = candidates.find((c) => c.norad_id === activeEvent.object_norad);
    return { target, object };
  }, [activeEvent, satellites, candidates]);

  return (
    <group>
      {/* Target orbits */}
      {showTargets &&
        satellites
          .filter((sat) => {
            if (sat.norad_id === selectedNoradId) return false; // Drawn separately
            if (activeEvent && sat.norad_id === activeEvent.target_norad) return false; // Drawn separately
            if (sat.orbit_regime === "LEO" && !showLEO) return false;
            if (sat.orbit_regime === "GEO" && !showGEO) return false;
            return true;
          })
          .map((sat) => (
            <OrbitPath
              key={`target-orbit-${sat.norad_id}`}
              rawJson={sat.raw_json}
              color="#10b981" // Green for Argentine satellites
              opacity={0.5}
            />
          ))}

      {/* Candidate/Debris orbits */}
      {showCandidates &&
        candidates
          .filter((sat) => {
            if (sat.norad_id === selectedNoradId) return false; // Drawn separately
            if (activeEvent && sat.norad_id === activeEvent.object_norad) return false; // Drawn separately
            if (sat.orbit_regime === "LEO" && !showLEO) return false;
            if (sat.orbit_regime === "GEO" && !showGEO) return false;
            return true;
          })
          .map((sat) => {
            const isDebris = sat.name.includes("DEB") || sat.name.includes("DEBRIS") || sat.name.includes("R/B");
            const color = isDebris ? "#f97316" : "#3b82f6"; // Orange for debris, Blue for active
            return (
              <OrbitPath
                key={`candidate-orbit-${sat.norad_id}`}
                rawJson={sat.raw_json}
                color={color}
                opacity={0.12}
              />
            );
          })}

      {/* Highlighted Selected Orbit */}
      {selectedSat && selectedSat.raw_json && (
        <OrbitPath
          key={`selected-orbit-${selectedSat.norad_id}`}
          rawJson={selectedSat.raw_json}
          color="#ffffff" // White highlight
          opacity={0.9}
          lineWidth={2.5}
          currentTime={currentTime}
        />
      )}

      {/* Highlighted Event Orbits */}
      {activeEvent && eventSats && (
        <>
          {eventSats.target?.raw_json && (
            <OrbitPath
              key={`event-target-orbit-${eventSats.target.norad_id}`}
              rawJson={eventSats.target.raw_json}
              color="#00ffff" // Neon cyan/celeste for operational satellite
              opacity={0.95}
              lineWidth={3.0}
              currentTime={currentTime}
            />
          )}
          {eventSats.object?.raw_json && (
            <OrbitPath
              key={`event-object-orbit-${eventSats.object.norad_id}`}
              rawJson={eventSats.object.raw_json}
              color={
                eventSats.object.name.includes("DEB") ||
                eventSats.object.name.includes("DEBRIS") ||
                eventSats.object.name.includes("R/B")
                  ? "#ffb74d" // Light Orange for space debris orbit
                  : "#3b82f6" // Light Blue for active candidate satellite orbit
              }
              opacity={0.95}
              lineWidth={3.0}
              currentTime={currentTime}
            />
          )}
        </>
      )}
    </group>
  );
}

