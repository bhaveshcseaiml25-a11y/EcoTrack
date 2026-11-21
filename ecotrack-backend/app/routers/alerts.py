from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select, update
from sqlalchemy.orm import Session, joinedload

from app.database import get_db
from app.models import Alert, utcnow
from app.presenters import alert_out
from app.schemas import AlertList, AlertOut

router = APIRouter(prefix="/alerts", tags=["Alerts & notifications"])


def _unread_count(db: Session) -> int:
    return (
        db.scalar(
            select(func.count()).select_from(Alert).where(Alert.is_read.is_(False), Alert.is_resolved.is_(False))
        )
        or 0
    )


def _get_alert(db: Session, alert_id: int) -> Alert:
    a = db.scalar(select(Alert).options(joinedload(Alert.bin)).where(Alert.id == alert_id))
    if not a:
        raise HTTPException(404, f"Alert {alert_id} not found")
    return a


@router.get("", response_model=AlertList)
def list_alerts(
    severity: str | None = Query(None, pattern="^(warning|high|critical)$"),
    status: str | None = Query(None, pattern="^(unread|read|resolved)$", description="Notification status"),
    bin_id: str | None = None,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """With no filters this is the full notification history, newest first."""
    q = select(Alert).options(joinedload(Alert.bin))
    if severity:
        q = q.where(Alert.severity == severity)
    if bin_id:
        q = q.where(Alert.bin_id == bin_id)
    if status == "resolved":
        q = q.where(Alert.is_resolved.is_(True))
    elif status == "read":
        q = q.where(Alert.is_read.is_(True), Alert.is_resolved.is_(False))
    elif status == "unread":
        q = q.where(Alert.is_read.is_(False), Alert.is_resolved.is_(False))

    total = db.scalar(select(func.count()).select_from(q.order_by(None).subquery())) or 0
    rows = db.scalars(q.order_by(Alert.created_at.desc(), Alert.id.desc()).limit(limit).offset(offset)).all()
    return AlertList(items=[alert_out(a) for a in rows], total=total, unread_count=_unread_count(db))


@router.get("/unread-count")
def unread_count(db: Session = Depends(get_db)):
    """For the notification bell badge."""
    return {"unreadCount": _unread_count(db)}


@router.post("/read-all")
def mark_all_read(db: Session = Depends(get_db)):
    res = db.execute(
        update(Alert).where(Alert.is_read.is_(False)).values(is_read=True, read_at=utcnow())
    )
    db.commit()
    return {"updated": res.rowcount, "unreadCount": _unread_count(db)}


@router.post("/{alert_id}/read", response_model=AlertOut)
def mark_read(alert_id: int, db: Session = Depends(get_db)):
    a = _get_alert(db, alert_id)
    if not a.is_read:
        a.is_read, a.read_at = True, utcnow()
        db.commit()
    return alert_out(a)


@router.post("/{alert_id}/resolve", response_model=AlertOut)
def resolve(alert_id: int, db: Session = Depends(get_db)):
    """Manually resolve an alert (also marks it read)."""
    a = _get_alert(db, alert_id)
    if not a.is_resolved:
        now = utcnow()
        a.is_resolved, a.resolved_at, a.resolution_note = True, now, "Resolved by administrator"
        if not a.is_read:
            a.is_read, a.read_at = True, now
        db.commit()
    return alert_out(a)
