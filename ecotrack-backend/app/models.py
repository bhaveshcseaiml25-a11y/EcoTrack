from datetime import datetime, timezone

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.services.status import bin_status


def utcnow() -> datetime:
    """Naive UTC timestamps everywhere (SQLite has no tz support); API adds 'Z'."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Bin(Base):
    __tablename__ = "bins"

    id: Mapped[str] = mapped_column(String(20), primary_key=True)  # e.g. BIN-001
    location: Mapped[str] = mapped_column(String(200))
    area: Mapped[str] = mapped_column(String(80), index=True)
    category: Mapped[str] = mapped_column(String(40), index=True)
    fill_level: Mapped[int] = mapped_column(Integer, default=0)
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    capacity_kg: Mapped[float] = mapped_column(Float, default=120.0)
    last_updated: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    alerts: Mapped[list["Alert"]] = relationship(back_populates="bin")

    @property
    def status(self) -> str:
        return bin_status(self.fill_level)

    @property
    def load_kg(self) -> float:
        return round(self.capacity_kg * self.fill_level / 100, 1)


class Alert(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    bin_id: Mapped[str] = mapped_column(ForeignKey("bins.id"), index=True)
    severity: Mapped[str] = mapped_column(String(20), index=True)
    fill_level: Mapped[int] = mapped_column(Integer)
    message: Mapped[str] = mapped_column(String(300), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)
    read_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    is_resolved: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    resolution_note: Mapped[str | None] = mapped_column(String(200), nullable=True)
    # Notifications are simulated in-app only; no SMS/email is ever sent.
    channel: Mapped[str] = mapped_column(String(20), default="in-app")

    bin: Mapped[Bin] = relationship(back_populates="alerts")

    @property
    def notification_status(self) -> str:
        if self.is_resolved:
            return "resolved"
        return "read" if self.is_read else "unread"


class Vehicle(Base):
    __tablename__ = "vehicles"

    id: Mapped[str] = mapped_column(String(20), primary_key=True)  # VEH-01
    name: Mapped[str] = mapped_column(String(80))
    driver: Mapped[str] = mapped_column(String(80))
    status: Mapped[str] = mapped_column(String(20), default="available", index=True)
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)
    capacity_kg: Mapped[float] = mapped_column(Float, default=2000.0)


class Route(Base):
    __tablename__ = "routes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    vehicle_id: Mapped[str] = mapped_column(ForeignKey("vehicles.id"), index=True)
    color: Mapped[str] = mapped_column(String(10))
    status: Mapped[str] = mapped_column(String(20), default="planned", index=True)
    distance_km: Mapped[float] = mapped_column(Float, default=0)
    est_minutes: Mapped[int] = mapped_column(Integer, default=0)
    baseline_distance_km: Mapped[float] = mapped_column(Float, default=0)
    baseline_minutes: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    vehicle: Mapped[Vehicle] = relationship()
    stops: Mapped[list["RouteStop"]] = relationship(
        back_populates="route", order_by="RouteStop.sequence", cascade="all, delete-orphan"
    )

    @property
    def progress_pct(self) -> int:
        if not self.stops:
            return 0
        return round(100 * sum(1 for s in self.stops if s.collected) / len(self.stops))


class RouteStop(Base):
    __tablename__ = "route_stops"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    route_id: Mapped[int] = mapped_column(ForeignKey("routes.id"), index=True)
    bin_id: Mapped[str] = mapped_column(ForeignKey("bins.id"))
    sequence: Mapped[int] = mapped_column(Integer)
    load_kg: Mapped[float] = mapped_column(Float, default=0)
    collected: Mapped[bool] = mapped_column(Boolean, default=False)
    collected_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    route: Mapped[Route] = relationship(back_populates="stops")
    bin: Mapped[Bin] = relationship()


class CollectionLog(Base):
    """One row per bin emptied; the source for analytics."""

    __tablename__ = "collection_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    bin_id: Mapped[str] = mapped_column(String(20), index=True)
    area: Mapped[str] = mapped_column(String(80), index=True)
    vehicle_id: Mapped[str] = mapped_column(String(20), index=True)
    kg: Mapped[float] = mapped_column(Float)
    distance_km: Mapped[float] = mapped_column(Float, default=0)
    collected_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)


class Worker(Base):
    __tablename__ = "workers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(80))
    department: Mapped[str] = mapped_column(String(80), default="Sanitation")


class Complaint(Base):
    __tablename__ = "complaints"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(30), unique=True, index=True)  # CMP-2026-00012
    name: Mapped[str] = mapped_column(String(100))
    contact: Mapped[str] = mapped_column(String(120))
    category: Mapped[str] = mapped_column(String(60), index=True)
    description: Mapped[str] = mapped_column(Text)
    location: Mapped[str] = mapped_column(String(200))
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    image_path: Mapped[str | None] = mapped_column(String(200), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="submitted", index=True)
    assigned_worker_id: Mapped[int | None] = mapped_column(ForeignKey("workers.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    assigned_worker: Mapped[Worker | None] = relationship()


class AppSetting(Base):
    """Key/value JSON store; one row (key='app') holds profile, thresholds, prefs."""

    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String(40), primary_key=True)
    value: Mapped[dict] = mapped_column(JSON)
