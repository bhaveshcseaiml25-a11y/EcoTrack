"""API contracts. JSON uses camelCase to match a TypeScript frontend."""

from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, PlainSerializer, model_validator
from pydantic.alias_generators import to_camel

# Stored as naive UTC; always emitted as ISO-8601 with a trailing Z.
UTCDateTime = Annotated[datetime, PlainSerializer(lambda d: d.isoformat() + "Z", return_type=str)]


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


# ---- Bins ----------------------------------------------------------------
BinStatus = Literal["normal", "moderate", "almost_full", "full"]
Severity = Literal["warning", "high", "critical"]


class BinOut(CamelModel):
    id: str
    location: str
    area: str
    category: str
    fill_level: int
    status: BinStatus
    latitude: float
    longitude: float
    capacity_kg: float
    load_kg: float
    last_updated: UTCDateTime


class BinList(CamelModel):
    items: list[BinOut]
    total: int


class BinMeta(CamelModel):
    areas: list[str]
    categories: list[str]
    statuses: list[str]


class SimulateFillIn(CamelModel):
    amount: int = Field(default=10, ge=1, le=100)


class SetFillIn(CamelModel):
    fill_level: int = Field(ge=0, le=100)


# ---- Alerts --------------------------------------------------------------
class AlertOut(CamelModel):
    id: int
    bin_id: str
    location: str
    area: str
    fill_level: int
    severity: Severity
    message: str
    created_at: UTCDateTime
    notification_status: Literal["unread", "read", "resolved"]
    is_read: bool
    is_resolved: bool
    resolved_at: UTCDateTime | None = None
    resolution_note: str | None = None
    channel: str = "in-app"


class AlertList(CamelModel):
    items: list[AlertOut]
    total: int
    unread_count: int


class BinUpdateResult(CamelModel):
    bin: BinOut
    new_alert: AlertOut | None = None


class TickResult(CamelModel):
    updated_bins: list[str]
    new_alerts: list[AlertOut]


# ---- Vehicles & routes ---------------------------------------------------
class VehicleOut(CamelModel):
    id: str
    name: str
    driver: str
    status: Literal["available", "active", "maintenance"]
    latitude: float
    longitude: float
    capacity_kg: float


class VehicleStatusIn(CamelModel):
    status: Literal["available", "maintenance"]


class RouteStopOut(CamelModel):
    sequence: int
    bin_id: str
    location: str
    area: str
    latitude: float
    longitude: float
    fill_level: int
    load_kg: float
    collected: bool
    collected_at: UTCDateTime | None = None


class RouteOut(CamelModel):
    id: int
    vehicle: VehicleOut
    color: str
    status: Literal["planned", "in_progress", "completed"]
    stops: list[RouteStopOut]
    stop_count: int
    distance_km: float
    estimated_minutes: int
    baseline_distance_km: float
    baseline_minutes: int
    time_saved_minutes: int
    progress_pct: int
    created_at: UTCDateTime
    started_at: UTCDateTime | None = None
    completed_at: UTCDateTime | None = None
    simulated: bool = True


class RouteSummary(CamelModel):
    total_vehicles_assigned: int
    total_bins_scheduled: int
    estimated_total_distance_km: float
    estimated_time_saved_minutes: int
    simulated: bool = True
    note: str = (
        "Simulated estimate: straight-line distances, fixed average speed and "
        "per-stop service time. Not a real-road routing result."
    )


class OptimizeResult(CamelModel):
    routes: list[RouteOut]
    summary: RouteSummary
    unassigned_bin_ids: list[str]
    simulated: bool = True


class CollectResult(CamelModel):
    route: RouteOut
    bin: BinOut


# ---- Complaints ----------------------------------------------------------
ComplaintStatus = Literal["submitted", "under_review", "assigned", "resolved"]


class WorkerOut(CamelModel):
    id: int
    name: str
    department: str


class ComplaintOut(CamelModel):
    id: str  # public complaint code, e.g. CMP-2026-00012
    name: str
    contact: str
    category: str
    description: str
    location: str
    latitude: float | None = None
    longitude: float | None = None
    image_url: str | None = None
    status: ComplaintStatus
    assigned_worker: WorkerOut | None = None
    created_at: UTCDateTime
    updated_at: UTCDateTime
    resolved_at: UTCDateTime | None = None


class ComplaintList(CamelModel):
    items: list[ComplaintOut]
    total: int


class ComplaintUpdateIn(CamelModel):
    status: ComplaintStatus | None = None
    assigned_worker_id: int | None = None

    @model_validator(mode="after")
    def _need_something(self):
        if self.status is None and self.assigned_worker_id is None:
            raise ValueError("Provide status and/or assignedWorkerId")
        return self


class CitizenComplaintStatus(CamelModel):
    """Limited public view for status tracking (no contact details)."""

    id: str
    category: str
    location: str
    status: ComplaintStatus
    created_at: UTCDateTime
    updated_at: UTCDateTime


# ---- Settings ------------------------------------------------------------
class ProfileSettings(CamelModel):
    name: str = Field(min_length=1, max_length=100)
    email: str = Field(max_length=120)
    phone: str = Field(default="", max_length=30)
    role: str = Field(max_length=80)


class NotificationSettings(CamelModel):
    in_app: bool = True
    email_simulated: bool = True
    sms_simulated: bool = False
    critical_only: bool = False


class ThresholdSettings(CamelModel):
    warning: int = Field(ge=1, le=100)
    high: int = Field(ge=1, le=100)
    critical: int = Field(ge=1, le=100)

    @model_validator(mode="after")
    def _ordered(self):
        if not (self.warning < self.high <= self.critical):
            raise ValueError("Thresholds must satisfy warning < high <= critical")
        return self


class SystemSettings(CamelModel):
    theme: Literal["light", "dark", "system"] = "light"
    language: str = "en"
    auto_refresh_seconds: int = Field(default=30, ge=5, le=600)
    simulation_auto_tick: bool = False


class AppSettings(CamelModel):
    profile: ProfileSettings
    notifications: NotificationSettings
    thresholds: ThresholdSettings
    system: SystemSettings


# ---- Dashboard & analytics ----------------------------------------------
class OverviewStats(CamelModel):
    total_bins: int
    critical_bins: int
    bins_awaiting_collection: int
    active_vehicles: int
    pending_complaints: int
    waste_collected_today_kg: float


class FillBucket(CamelModel):
    status: BinStatus
    label: str
    count: int


class VehicleSummary(CamelModel):
    total: int
    available: int
    active: int
    maintenance: int


class Overview(CamelModel):
    stats: OverviewStats
    recent_alerts: list[AlertOut]
    recent_complaints: list[ComplaintOut]
    fill_distribution: list[FillBucket]
    vehicles: VehicleSummary
