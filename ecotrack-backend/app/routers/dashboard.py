from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import utcnow, Alert, Bin, CollectionLog, Complaint, Route, RouteStop, Vehicle
from app.presenters import alert_out, complaint_out
from app.schemas import FillBucket, Overview, OverviewStats, VehicleSummary
from app.services.settings_service import get_thresholds

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

BUCKET_LABELS = [
    ("normal", "Normal (0-49%)", 0, 49),
    ("moderate", "Moderate (50-79%)", 50, 79),
    ("almost_full", "Almost Full (80-99%)", 80, 99),
    ("full", "Full (100%)", 100, 100),
]


@router.get("/overview", response_model=Overview)
def overview(db: Session = Depends(get_db)):
    warning = get_thresholds(db)["warning"]
    today = utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

    total_bins = db.scalar(select(func.count()).select_from(Bin)) or 0
    critical = db.scalar(select(func.count()).select_from(Bin).where(Bin.fill_level >= 100)) or 0
    awaiting = db.scalar(select(func.count()).select_from(Bin).where(Bin.fill_level >= warning)) or 0
    active_vehicles = db.scalar(select(func.count()).select_from(Vehicle).where(Vehicle.status == "active")) or 0
    pending = (
        db.scalar(select(func.count()).select_from(Complaint).where(Complaint.status != "resolved")) or 0
    )
    kg_today = db.scalar(select(func.coalesce(func.sum(CollectionLog.kg), 0.0)).where(CollectionLog.collected_at >= today))

    recent_alerts = db.scalars(
        select(Alert).options(joinedload(Alert.bin)).where(Alert.is_resolved.is_(False))
        .order_by(Alert.created_at.desc()).limit(5)
    ).all()
    recent_complaints = db.scalars(
        select(Complaint).options(joinedload(Complaint.assigned_worker)).order_by(Complaint.created_at.desc()).limit(5)
    ).all()

    buckets = []
    for status, label, lo, hi in BUCKET_LABELS:
        count = db.scalar(select(func.count()).select_from(Bin).where(Bin.fill_level.between(lo, hi))) or 0
        buckets.append(FillBucket(status=status, label=label, count=count))

    v_counts = dict(db.execute(select(Vehicle.status, func.count()).group_by(Vehicle.status)).all())
    vehicles = VehicleSummary(
        total=sum(v_counts.values()),
        available=v_counts.get("available", 0),
        active=v_counts.get("active", 0),
        maintenance=v_counts.get("maintenance", 0),
    )

    return Overview(
        stats=OverviewStats(
            total_bins=total_bins,
            critical_bins=critical,
            bins_awaiting_collection=awaiting,
            active_vehicles=active_vehicles,
            pending_complaints=pending,
            waste_collected_today_kg=round(float(kg_today or 0), 1),
        ),
        recent_alerts=[alert_out(a) for a in recent_alerts],
        recent_complaints=[complaint_out(c) for c in recent_complaints],
        fill_distribution=buckets,
        vehicles=vehicles,
    )
