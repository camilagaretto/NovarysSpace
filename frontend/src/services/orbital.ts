import * as satellite from "satellite.js";

// Earth radius in visual units
export const EARTH_RADIUS_3D = 4;
// Scale factor: Earth physical radius is ~6378.1 km
export const SCALE_FACTOR = EARTH_RADIUS_3D / 6378.1;

export interface Position3D {
  x: number;
  y: number;
  z: number;
  altitude: number;
  velocity: number;
}

// Helpers for TLE generation from OMM JSON
function padLeft(str: string, length: number, padChar = " "): string {
  while (str.length < length) {
    str = padChar + str;
  }
  return str;
}

function padRight(str: string, length: number, padChar = " "): string {
  while (str.length < length) {
    str = str + padChar;
  }
  return str;
}

function calculateTleChecksum(line: string): number {
  let sum = 0;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char >= '0' && char <= '9') {
      sum += parseInt(char, 10);
    } else if (char === '-') {
      sum += 1;
    }
  }
  return sum % 10;
}

function formatBstar(val: number): string {
  if (val === 0 || isNaN(val)) return " 00000-0";
  const sign = val < 0 ? "-" : " ";
  const absVal = Math.abs(val);
  const exp = Math.floor(Math.log10(absVal)) + 1;
  const mantissa = Math.round((absVal / Math.pow(10, exp)) * 100000);
  const expSign = exp <= 0 ? "-" : "+";
  const expVal = Math.abs(exp);
  return `${sign}${padLeft(mantissa.toString().substring(0, 5), 5, "0")}${expSign}${expVal.toString().substring(0, 1)}`;
}

function getEpochString(epochIso: string): string {
  const date = new Date(epochIso);
  const yearFull = date.getUTCFullYear();
  const year2 = (yearFull % 100).toString().padStart(2, "0");
  
  const startOfYear = new Date(Date.UTC(yearFull, 0, 1));
  const diffMs = date.getTime() - startOfYear.getTime();
  const oneDayMs = 24 * 60 * 60 * 1000;
  const dayOfYear = diffMs / oneDayMs + 1;
  
  const dayStr = dayOfYear.toFixed(8).padStart(12, "0");
  return `${year2}${dayStr}`;
}

/**
 * Custom OMM JSON to satrec converter for satellite.js v4.x
 */
export function jsonToSatrec(rawJson: any): satellite.SatRec {
  const norad = padLeft((rawJson.NORAD_CAT_ID || 0).toString(), 5, "0");
  const epoch = getEpochString(rawJson.EPOCH || new Date().toISOString());
  
  const bstarVal = parseFloat(rawJson.BSTAR || 0);
  const bstar = formatBstar(bstarVal);
  
  const meanMotionDotVal = parseFloat(rawJson.MEAN_MOTION_DOT || 0);
  const signMmDot = meanMotionDotVal < 0 ? "-" : " ";
  const meanMotionDot = `${signMmDot}${Math.abs(meanMotionDotVal).toFixed(8).substring(1)}`;

  // Construct Line 1 without checksum
  const line1Base = `1 ${norad}U 26001A   ${epoch} ${meanMotionDot}  00000-0 ${bstar} 0  999`;
  const checksum1 = calculateTleChecksum(line1Base);
  const line1 = `${line1Base}${checksum1}`;

  // Formatting Line 2 Keplerian parameters
  const inclination = padLeft(parseFloat(rawJson.INCLINATION || 0).toFixed(4), 8, " ");
  const raan = padLeft(parseFloat(rawJson.RA_OF_ASC_NODE || 0).toFixed(4), 8, " ");
  
  // Eccentricity in TLE omits leading "0."
  const eccRaw = parseFloat(rawJson.ECCENTRICITY || 0).toFixed(7);
  const eccentricity = eccRaw.substring(eccRaw.indexOf(".") + 1);

  const argPerigee = padLeft(parseFloat(rawJson.ARG_OF_PERICENTER || 0).toFixed(4), 8, " ");
  const meanAnomaly = padLeft(parseFloat(rawJson.MEAN_ANOMALY || 0).toFixed(4), 8, " ");
  const meanMotion = padLeft(parseFloat(rawJson.MEAN_MOTION || 0).toFixed(8), 11, " ");
  
  const revs = padLeft((rawJson.REV_AT_EPOCH || 0).toString(), 5, "0");

  const line2Base = `2 ${norad} ${inclination} ${raan} ${eccentricity} ${argPerigee} ${meanAnomaly} ${meanMotion}${revs}`;
  const checksum2 = calculateTleChecksum(line2Base);
  const line2 = `${line2Base}${checksum2}`;

  return satellite.twoline2satrec(line1, line2);
}

/**
 * Propagates a satellite's position to a specific date.
 * Returns Cartesian coordinates (X, Y, Z) and telemetry.
 */
export function getSatellitePosition(rawJson: any, date: Date): Position3D | null {
  try {
    if (!rawJson) return null;
    const satrec = jsonToSatrec(rawJson);
    const positionAndVelocity = satellite.propagate(satrec, date);
    const positionEci = positionAndVelocity ? positionAndVelocity.position : null;
    const velocityEci = positionAndVelocity ? positionAndVelocity.velocity : null;

    if (!positionEci || typeof positionEci === "boolean") return null;

    // Convert ECI (TEME) directly to 3D Cartesian coordinates
    // Three.js coordinates: Y is North pole, X is Vernal Equinox, Z is orthogonal
    const x = positionEci.x * SCALE_FACTOR;
    const y = positionEci.z * SCALE_FACTOR;
    const z = -positionEci.y * SCALE_FACTOR;

    // Calculate geodetic height for altitude telemetry
    const gmst = satellite.gstime(date);
    const positionGd = satellite.eciToGeodetic(positionEci as satellite.EciVec3<number>, gmst);
    const height = positionGd.height; // in km

    // Calculate velocity magnitude (in km/s)
    let velocityMag = 0;
    if (velocityEci && typeof velocityEci !== "boolean") {
      const v = velocityEci as satellite.EciVec3<number>;
      velocityMag = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
    }

    return {
      x,
      y,
      z,
      altitude: height,
      velocity: velocityMag,
    };
  } catch (e) {
    console.error("Propagation error:", e);
    return null;
  }
}

/**
 * Generates a list of 3D points representing the orbit path.
 * Samples points along one complete orbital period.
 */
export function getOrbitPath(rawJson: any, date: Date, pointsCount = 120): [number, number, number][] {
  const points: [number, number, number][] = [];
  try {
    if (!rawJson) return points;
    const satrec = jsonToSatrec(rawJson);
    
    // Orbital period in minutes = 1440 / mean_motion
    const meanMotion = parseFloat(rawJson.MEAN_MOTION);
    if (!meanMotion || isNaN(meanMotion)) return points;

    const periodMinutes = 1440 / meanMotion;
    const stepMs = (periodMinutes * 60 * 1000) / pointsCount;
    const baseTimeMs = date.getTime();

    for (let i = 0; i <= pointsCount; i++) {
      const sampleTime = new Date(baseTimeMs + i * stepMs);
      const positionAndVelocity = satellite.propagate(satrec, sampleTime);
      const positionEci = positionAndVelocity ? positionAndVelocity.position : null;

      if (positionEci && typeof positionEci !== "boolean") {
        const x = positionEci.x * SCALE_FACTOR;
        const y = positionEci.z * SCALE_FACTOR;
        const z = -positionEci.y * SCALE_FACTOR;
        points.push([x, y, z]);
      }
    }
  } catch (e) {
    console.error("Error generating orbit path:", e);
  }
  return points;
}
