export interface RiskDetails {
  label: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  color: string;
  badgeColor: string;
  badgeBorder: string;
  iconName: "alert-triangle" | "shield-alert" | "shield-check" | "activity";
  priority: number;
}

/**
 * Calculates risk level details based on miss distance in km.
 * 
 * Rules:
 * < 1 km      => CRITICAL (Neon Red #FF3B5C)
 * 1 - 5 km    => HIGH (Orange #FF8A00)
 * 5 - 10 km   => MEDIUM (Yellow #FFD54A)
 * > 10 km     => LOW (Emerald Green #00D084)
 */
export function calculateRisk(distanceKm: number): RiskDetails {
  if (distanceKm < 1) {
    return {
      label: "CRITICAL",
      color: "#FF3B5C",
      badgeColor: "rgba(255, 59, 92, 0.12)",
      badgeBorder: "rgba(255, 59, 92, 0.3)",
      iconName: "shield-alert",
      priority: 1
    };
  } else if (distanceKm >= 1 && distanceKm <= 5) {
    return {
      label: "HIGH",
      color: "#FF8A00",
      badgeColor: "rgba(255, 138, 0, 0.12)",
      badgeBorder: "rgba(255, 138, 0, 0.3)",
      iconName: "alert-triangle",
      priority: 2
    };
  } else if (distanceKm > 5 && distanceKm <= 10) {
    return {
      label: "MEDIUM",
      color: "#FFD54A",
      badgeColor: "rgba(255, 213, 74, 0.12)",
      badgeBorder: "rgba(255, 213, 74, 0.3)",
      iconName: "activity",
      priority: 3
    };
  } else {
    return {
      label: "LOW",
      color: "#00D084",
      badgeColor: "rgba(0, 208, 132, 0.12)",
      badgeBorder: "rgba(0, 208, 132, 0.3)",
      iconName: "shield-check",
      priority: 4
    };
  }
}
