import { useMemo } from "react";
import { Line } from "@react-three/drei";
import { getSatellitePosition } from "../services/orbital";
import { calculateRisk } from "../utils/calculateRisk";
import type { ProximityEvent, Satellite } from "../types";

interface ActiveEventLineProps {
  event: ProximityEvent;
  targetSat: Satellite;
  objectSat: Satellite;
  time: Date;
}

function ActiveEventLine({ event, targetSat, objectSat, time }: ActiveEventLineProps) {
  const positions = useMemo(() => {
    if (!targetSat?.raw_json || !objectSat?.raw_json) return null;
    const posTarget = getSatellitePosition(targetSat.raw_json, time);
    const posObject = getSatellitePosition(objectSat.raw_json, time);
    if (!posTarget || !posObject) return null;
    return {
      start: [posTarget.x, posTarget.y, posTarget.z] as [number, number, number],
      end: [posObject.x, posObject.y, posObject.z] as [number, number, number],
    };
  }, [targetSat, objectSat, time]);

  if (!positions) return null;

  const severityColor = calculateRisk(event.miss_distance_km).color;

  const points = [positions.start, positions.end];

  return (
    <group>
      {/* Line connecting the two satellites */}
      <Line points={points} color={severityColor} lineWidth={2} />


      {/* Pulse rings around target */}
      <mesh position={positions.start}>
        <sphereGeometry args={[0.2, 8, 8]} />
        <meshBasicMaterial color={severityColor} transparent opacity={0.4} />
      </mesh>

      {/* Pulse rings around candidate */}
      <mesh position={positions.end}>
        <sphereGeometry args={[0.2, 8, 8]} />
        <meshBasicMaterial color={severityColor} transparent opacity={0.4} />
      </mesh>
    </group>
  );
}

interface EventLayerProps {
  events: ProximityEvent[];
  satellites: Satellite[];
  candidates: Satellite[];
  currentTime: Date;
  selectedEventId: number | null;
}

export function EventLayer({
  events,
  satellites,
  candidates,
  currentTime,
  selectedEventId,
}: EventLayerProps) {
  const activeEvent = useMemo(() => {
    if (!selectedEventId) return null;
    return events.find((e) => e.id === selectedEventId) || null;
  }, [events, selectedEventId]);

  const associatedSats = useMemo(() => {
    if (!activeEvent) return null;
    const target = satellites.find((s) => s.norad_id === activeEvent.target_norad);
    const object = candidates.find((c) => c.norad_id === activeEvent.object_norad);
    if (!target || !object) return null;
    return { target, object };
  }, [activeEvent, satellites, candidates]);

  if (!activeEvent || !associatedSats) return null;

  return (
    <ActiveEventLine
      event={activeEvent}
      targetSat={associatedSats.target}
      objectSat={associatedSats.object}
      time={currentTime}
    />
  );
}
