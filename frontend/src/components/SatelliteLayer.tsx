import { useMemo } from "react";
import { getSatellitePosition } from "../services/orbital";
import type { Satellite } from "../types";

interface SatelliteMarkerProps {
  sat: Satellite;
  color: string;
  size: number;
  time: Date;
  isSelected: boolean;
  isDebris: boolean;
  onSelect: (sat: Satellite, pos: [number, number, number], telemetry: any) => void;
}

function SatelliteMarker({ sat, color, size, time, isSelected, isDebris, onSelect }: SatelliteMarkerProps) {
  const result = useMemo(() => {
    return getSatellitePosition(sat.raw_json, time);
  }, [sat.raw_json, time]);

  if (!result) return null;

  const { x, y, z, altitude, velocity } = result;

  const handleClick = (e: any) => {
    e.stopPropagation();
    onSelect(sat, [x, y, z], { altitude, velocity });
  };

  return (
    <group position={[x, y, z]}>
      {/* Clickable area */}
      <mesh onClick={handleClick}>
        <sphereGeometry args={[size * 3, 8, 8]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      {/* Visual Marker */}
      {isDebris ? (
        // Debris: Irregular rock/fragment shape
        <mesh>
          <dodecahedronGeometry args={[isSelected ? size * 1.5 : size, 0]} />
          <meshStandardMaterial
            color={isSelected ? "#ffffff" : color}
            emissive={isSelected ? "#ffffff" : color}
            emissiveIntensity={1.8}
            roughness={0.2}
            metalness={0.8}
          />
        </mesh>
      ) : (
        // Satellite: 3D low-poly structure
        <group scale={isSelected ? 1.6 : 1.0}>
          {/* Main Bus / Body */}
          <mesh>
            <boxGeometry args={[size, size, size]} />
            <meshStandardMaterial
              color={isSelected ? "#ffffff" : color}
              emissive={isSelected ? "#ffffff" : color}
              emissiveIntensity={1.8}
              roughness={0.2}
              metalness={0.8}
            />
          </mesh>
          {/* Left Solar Wing */}
          <mesh position={[-size * 1.6, 0, 0]}>
            <boxGeometry args={[size * 1.8, size * 0.5, size * 0.05]} />
            <meshStandardMaterial
              color="#0088ff"
              emissive="#0088ff"
              emissiveIntensity={1.2}
              roughness={0.15}
              metalness={0.9}
            />
          </mesh>
          {/* Right Solar Wing */}
          <mesh position={[size * 1.6, 0, 0]}>
            <boxGeometry args={[size * 1.8, size * 0.5, size * 0.05]} />
            <meshStandardMaterial
              color="#0088ff"
              emissive="#0088ff"
              emissiveIntensity={1.2}
              roughness={0.15}
              metalness={0.9}
            />
          </mesh>
          {/* Communication Dish */}
          <mesh position={[0, 0, size * 0.6]} rotation={[Math.PI / 2, 0, 0]}>
            <coneGeometry args={[size * 0.25, size * 0.3, 8]} />
            <meshStandardMaterial
              color={isSelected ? "#ffffff" : "#b0b0b0"}
              emissive={isSelected ? "#ffffff" : "#555555"}
              emissiveIntensity={1.0}
              roughness={0.3}
              metalness={0.8}
            />
          </mesh>
        </group>
      )}

      {/* Pulsing Selection Ring */}
      {isSelected && (
        <mesh>
          <ringGeometry args={[size * 2.5, size * 2.8, 16]} />
          <meshBasicMaterial color="#ffffff" side={2} transparent opacity={0.8} />
        </mesh>
      )}
    </group>
  );
}

interface SatelliteLayerProps {
  satellites: Satellite[];
  candidates: Satellite[];
  showLEO: boolean;
  showGEO: boolean;
  showTargets: boolean;
  showCandidates: boolean;
  currentTime: Date;
  selectedNoradId: number | null;
  onSelectSatellite: (sat: Satellite, position: [number, number, number], telemetry: any) => void;
}

export function SatelliteLayer({
  satellites,
  candidates,
  showLEO,
  showGEO,
  showTargets,
  showCandidates,
  currentTime,
  selectedNoradId,
  onSelectSatellite,
}: SatelliteLayerProps) {
  const filteredTargets = useMemo(() => {
    if (!showTargets) return [];
    return satellites.filter((sat) => {
      if (sat.orbit_regime === "LEO" && !showLEO) return false;
      if (sat.orbit_regime === "GEO" && !showGEO) return false;
      return true;
    });
  }, [satellites, showTargets, showLEO, showGEO]);

  const filteredCandidates = useMemo(() => {
    if (!showCandidates) return [];
    return candidates.filter((sat) => {
      if (sat.orbit_regime === "LEO" && !showLEO) return false;
      if (sat.orbit_regime === "GEO" && !showGEO) return false;
      return true;
    });
  }, [candidates, showCandidates, showLEO, showGEO]);

  return (
    <group>
      {/* Target Satellites */}
      {filteredTargets.map((sat) => (
        <SatelliteMarker
          key={`sat-${sat.norad_id}`}
          sat={sat}
          color="#a5f3fc" // Celeste clarito / Light Cyan
          size={0.12}
          time={currentTime}
          isSelected={selectedNoradId === sat.norad_id}
          isDebris={false}
          onSelect={onSelectSatellite}
        />
      ))}

      {/* Candidate / Debris Satellites */}
      {filteredCandidates.map((sat) => {
        const isDebris = sat.name.includes("DEB") || sat.name.includes("DEBRIS") || sat.name.includes("R/B");
        const color = isDebris ? "#ffb74d" : "#a5f3fc"; // Naranja clarito for debris, Celeste clarito for active
        const size = isDebris ? 0.05 : 0.08; // Debris is smaller than active satellites
        return (
          <SatelliteMarker
            key={`cand-${sat.norad_id}`}
            sat={sat}
            color={color}
            size={size}
            time={currentTime}
            isSelected={selectedNoradId === sat.norad_id}
            isDebris={isDebris}
            onSelect={onSelectSatellite}
          />
        );
      })}
    </group>
  );
}
