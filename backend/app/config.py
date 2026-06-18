from functools import lru_cache
from pathlib import Path
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(populate_by_name=True, env_file=".env")

    db_path: Path = Field(default=Path("novarys.db"), alias="NOVARYS_DB_PATH")
    celestrak_base_url: str = Field(
        default="https://celestrak.org/NORAD/elements/gp.php",
        alias="CELESTRAK_BASE_URL",
    )
    cache_ttl_seconds: int = Field(default=7200, alias="CELESTRAK_CACHE_TTL_SECONDS")
    candidate_limit_per_query: int = Field(default=40, alias="CANDIDATE_LIMIT_PER_QUERY")
    max_candidates_per_regime: int = Field(default=100, alias="MAX_CANDIDATES_PER_REGIME")
    scan_threshold_km: float = Field(default=50.0, alias="SCAN_THRESHOLD_KM")
    coarse_step_minutes: int = Field(default=10, alias="COARSE_STEP_MINUTES")
    refine_step_seconds: int = Field(default=30, alias="REFINE_STEP_SECONDS")
    frontend_origin: str = Field(default="http://localhost:5173", alias="FRONTEND_ORIGIN")


@lru_cache
def get_settings() -> Settings:
    return Settings()
