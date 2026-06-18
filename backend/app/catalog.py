from dataclasses import dataclass


@dataclass(frozen=True)
class TargetSatellite:
    norad_id: int
    name: str
    orbit_regime: str


TARGET_SATELLITES: tuple[TargetSatellite, ...] = (
    TargetSatellite(43641, "SAOCOM-1A", "LEO"),
    TargetSatellite(46265, "SAOCOM-1B", "LEO"),
    TargetSatellite(40272, "ARSAT-1", "GEO"),
    TargetSatellite(40941, "ARSAT-2", "GEO"),
)


LEO_CANDIDATE_QUERIES: tuple[dict[str, str], ...] = (
    {"NAME": "COSMOS 2251 DEB"},
    {"NAME": "IRIDIUM 33 DEB"},
    {"GROUP": "ACTIVE"},
)


GEO_CANDIDATE_QUERIES: tuple[dict[str, str], ...] = (
    {"SPECIAL": "GPZ-PLUS"},
)
