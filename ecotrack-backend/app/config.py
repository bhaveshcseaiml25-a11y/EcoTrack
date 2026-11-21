import os
from dataclasses import dataclass, field


def _split(value: str) -> list[str]:
    return [v.strip() for v in value.split(",") if v.strip()]


@dataclass(frozen=True)
class Settings:
    database_url: str = field(
        default_factory=lambda: os.getenv("ECOTRACK_DATABASE_URL", "sqlite:///./ecotrack.db")
    )
    cors_origins: list[str] = field(
        default_factory=lambda: _split(os.getenv("ECOTRACK_CORS_ORIGINS", "http://localhost:3000"))
    )
    upload_dir: str = field(default_factory=lambda: os.getenv("ECOTRACK_UPLOAD_DIR", "./uploads"))
    city_lat: float = field(default_factory=lambda: float(os.getenv("ECOTRACK_CITY_LAT", "12.9716")))
    city_lng: float = field(default_factory=lambda: float(os.getenv("ECOTRACK_CITY_LNG", "77.5946")))
    sim_interval_seconds: int = field(
        default_factory=lambda: int(os.getenv("ECOTRACK_SIM_INTERVAL_SECONDS", "15"))
    )
    max_upload_bytes: int = 5 * 1024 * 1024


settings = Settings()
