import csv
import io
from collections import defaultdict
from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import utcnow, Alert, Bin, CollectionLog, Complaint, Vehicle

router = APIRouter(prefix="/analytics", tags=["Analytics & reports"])


def _range(from_date: date | None, to_date: date | None) -> tuple[datetime, datetime]:
    end = to_date or utcnow().date()
    start = from_date or end - timedelta(days=29)
    if start > end:
        raise HTTPException(422, "from must not be after to")
    if (end - start).days > 366:
        raise HTTPException(422, "Range may not exceed 366 days")
    return datetime.combine(start, time.min), datetime.combine(end, time.max)


def _bucket(d: datetime, granularity: str) -> str:
    if granularity == "weekly":
        y, w, _ = d.isocalendar()
        return f"{y}-W{w:02d}"
    if granularity == "monthly":
        return d.strftime("%Y-%m")
    return d.strftime("%Y-%m-%d")


def _logs(db: Session, start: datetime, end: datetime, area: str | None = None):
    q = select(CollectionLog).where(CollectionLog.collected_at.between(start, end))
    if area:
        q = q.where(CollectionLog.area == area)
    return db.scalars(q).all()


@router.get("/collection-trend")
def collection_trend(
    from_date: date | None = Query(None, alias="from"),
    to_date: date | None = Query(None, alias="to"),
    granularity: str = Query("daily", pattern="^(daily|weekly|monthly)$"),
    area: str | None = None,
    db: Session = Depends(get_db),
):
    start, end = _range(from_date, to_date)
    kg: dict[str, float] = defaultdict(float)
    cnt: dict[str, int] = defaultdict(int)
    for log in _logs(db, start, end, area):
        k = _bucket(log.collected_at, granularity)
        kg[k] += log.kg
        cnt[k] += 1
    points = [{"period": k, "kg": round(kg[k], 1), "collections": cnt[k]} for k in sorted(kg)]
    return {"granularity": granularity, "from": start.date(), "to": end.date(), "points": points}


@router.get("/area-waste")
def area_waste(
    from_date: date | None = Query(None, alias="from"),
    to_date: date | None = Query(None, alias="to"),
    db: Session = Depends(get_db),
):
    start, end = _range(from_date, to_date)
    kg: dict[str, float] = defaultdict(float)
    for log in _logs(db, start, end):
        kg[log.area] += log.kg
    avg_fill = dict(db.execute(select(Bin.area, func.avg(Bin.fill_level)).group_by(Bin.area)).all())
    return {
        "areas": [
            {"area": a, "kg": round(kg.get(a, 0.0), 1), "avgFillLevel": round(float(avg_fill[a]), 1)}
            for a in sorted(avg_fill)
        ]
    }


@router.get("/complaints-trend")
def complaints_trend(
    from_date: date | None = Query(None, alias="from"),
    to_date: date | None = Query(None, alias="to"),
    granularity: str = Query("daily", pattern="^(daily|weekly|monthly)$"),
    db: Session = Depends(get_db),
):
    start, end = _range(from_date, to_date)
    received: dict[str, int] = defaultdict(int)
    resolved: dict[str, int] = defaultdict(int)
    for c in db.scalars(select(Complaint).where(Complaint.created_at.between(start, end))):
        received[_bucket(c.created_at, granularity)] += 1
    for c in db.scalars(select(Complaint).where(Complaint.resolved_at.between(start, end))):
        resolved[_bucket(c.resolved_at, granularity)] += 1
    keys = sorted(set(received) | set(resolved))
    return {
        "granularity": granularity,
        "points": [{"period": k, "received": received[k], "resolved": resolved[k]} for k in keys],
        "totals": {"received": sum(received.values()), "resolved": sum(resolved.values())},
    }


@router.get("/vehicle-performance")
def vehicle_performance(
    from_date: date | None = Query(None, alias="from"),
    to_date: date | None = Query(None, alias="to"),
    db: Session = Depends(get_db),
):
    start, end = _range(from_date, to_date)
    stats: dict[str, dict] = defaultdict(lambda: {"kg": 0.0, "collections": 0, "distanceKm": 0.0})
    for log in _logs(db, start, end):
        s = stats[log.vehicle_id]
        s["kg"] += log.kg
        s["collections"] += 1
        s["distanceKm"] += log.distance_km
    out = []
    for v in db.scalars(select(Vehicle).order_by(Vehicle.id)):
        s = stats.get(v.id, {"kg": 0.0, "collections": 0, "distanceKm": 0.0})
        out.append(
            {
                "vehicleId": v.id,
                "name": v.name,
                "kg": round(s["kg"], 1),
                "collections": s["collections"],
                "distanceKm": round(s["distanceKm"], 1),
                "kgPerKm": round(s["kg"] / s["distanceKm"], 1) if s["distanceKm"] else 0.0,
            }
        )
    return {"vehicles": out}


@router.get("/efficiency")
def efficiency(
    from_date: date | None = Query(None, alias="from"),
    to_date: date | None = Query(None, alias="to"),
    db: Session = Depends(get_db),
):
    """collectionRatePct = alerts raised in range that are resolved / alerts raised.
    kgPerKm = waste collected per km driven. Both are derived from stored data."""
    start, end = _range(from_date, to_date)
    alerts = db.scalars(select(Alert).where(Alert.created_at.between(start, end))).all()
    resolved = sum(1 for a in alerts if a.is_resolved)
    logs = _logs(db, start, end)
    total_kg = sum(entry.kg for entry in logs)
    total_km = sum(entry.distance_km for entry in logs)
    return {
        "alertsRaised": len(alerts),
        "alertsResolved": resolved,
        "collectionRatePct": round(100 * resolved / len(alerts), 1) if alerts else None,
        "totalKg": round(total_kg, 1),
        "totalKm": round(total_km, 1),
        "kgPerKm": round(total_kg / total_km, 1) if total_km else None,
    }


@router.get("/fill-distribution")
def fill_distribution(db: Session = Depends(get_db)):
    from app.routers.dashboard import BUCKET_LABELS

    return {
        "buckets": [
            {
                "status": s,
                "label": label,
                "count": db.scalar(select(func.count()).select_from(Bin).where(Bin.fill_level.between(lo, hi))) or 0,
            }
            for s, label, lo, hi in BUCKET_LABELS
        ]
    }


@router.get("/report.csv")
def export_report(
    from_date: date | None = Query(None, alias="from"),
    to_date: date | None = Query(None, alias="to"),
    db: Session = Depends(get_db),
):
    """Real CSV export of the collection log for the selected range."""
    start, end = _range(from_date, to_date)
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["collected_at_utc", "bin_id", "area", "vehicle_id", "kg", "distance_km"])
    for log in sorted(_logs(db, start, end), key=lambda x: x.collected_at):
        w.writerow([log.collected_at.isoformat(), log.bin_id, log.area, log.vehicle_id, log.kg, log.distance_km])
    return Response(
        buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="ecotrack-report-{start.date()}_{end.date()}.csv"'},
    )
