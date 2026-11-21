from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Alert, Bin, utcnow
from app.services.settings_service import get_thresholds
from app.services.status import alert_severity, severity_rank


def _message(bin_: Bin, severity: str) -> str:
    label = {"warning": "Warning", "high": "High priority", "critical": "Critical"}[severity]
    return f"{label}: {bin_.id} at {bin_.location} is {bin_.fill_level}% full."


def sync_alerts_for_bin(db: Session, bin_: Bin, resolution_note: str = "Fill level dropped below threshold") -> Alert | None:
    """Create/escalate/auto-resolve alerts after a bin's fill level changed.

    Returns the newly created Alert, or None if nothing new was raised.
    Caller is responsible for db.commit().
    """
    severity = alert_severity(bin_.fill_level, get_thresholds(db))
    open_alerts = db.scalars(
        select(Alert).where(Alert.bin_id == bin_.id, Alert.is_resolved.is_(False)).order_by(Alert.id.desc())
    ).all()
    now = utcnow()

    if severity is None:
        for a in open_alerts:
            a.is_resolved, a.resolved_at, a.resolution_note = True, now, resolution_note
        return None

    top_open = open_alerts[0] if open_alerts else None
    if top_open and severity_rank(top_open.severity) >= severity_rank(severity):
        top_open.fill_level = bin_.fill_level  # keep the live number current
        return None

    for a in open_alerts:  # escalation: close the lower-severity alert, open a new one
        a.is_resolved, a.resolved_at, a.resolution_note = True, now, "Escalated"

    alert = Alert(
        bin_id=bin_.id,
        severity=severity,
        fill_level=bin_.fill_level,
        message=_message(bin_, severity),
        created_at=now,
    )
    db.add(alert)
    return alert


def set_fill_level(db: Session, bin_: Bin, fill: int, resolution_note: str = "Fill level dropped below threshold") -> Alert | None:
    from app.services.status import clamp_fill

    bin_.fill_level = clamp_fill(fill)
    bin_.last_updated = utcnow()
    alert = sync_alerts_for_bin(db, bin_, resolution_note)
    db.commit()
    return alert
