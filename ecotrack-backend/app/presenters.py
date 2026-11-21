"""Convert ORM objects into API schemas (for fields that are not 1:1 columns)."""

from app.models import Alert, Complaint, Route
from app.schemas import AlertOut, ComplaintOut, RouteOut, RouteStopOut, VehicleOut, WorkerOut


def alert_out(a: Alert) -> AlertOut:
    return AlertOut(
        id=a.id,
        bin_id=a.bin_id,
        location=a.bin.location,
        area=a.bin.area,
        fill_level=a.fill_level,
        severity=a.severity,
        message=a.message,
        created_at=a.created_at,
        notification_status=a.notification_status,
        is_read=a.is_read,
        is_resolved=a.is_resolved,
        resolved_at=a.resolved_at,
        resolution_note=a.resolution_note,
        channel=a.channel,
    )


def complaint_out(c: Complaint) -> ComplaintOut:
    return ComplaintOut(
        id=c.code,
        name=c.name,
        contact=c.contact,
        category=c.category,
        description=c.description,
        location=c.location,
        latitude=c.latitude,
        longitude=c.longitude,
        image_url=f"/uploads/{c.image_path}" if c.image_path else None,
        status=c.status,
        assigned_worker=WorkerOut.model_validate(c.assigned_worker) if c.assigned_worker else None,
        created_at=c.created_at,
        updated_at=c.updated_at,
        resolved_at=c.resolved_at,
    )


def route_out(r: Route) -> RouteOut:
    stops = [
        RouteStopOut(
            sequence=s.sequence,
            bin_id=s.bin_id,
            location=s.bin.location,
            area=s.bin.area,
            latitude=s.bin.latitude,
            longitude=s.bin.longitude,
            fill_level=s.bin.fill_level,
            load_kg=s.load_kg,
            collected=s.collected,
            collected_at=s.collected_at,
        )
        for s in r.stops
    ]
    return RouteOut(
        id=r.id,
        vehicle=VehicleOut.model_validate(r.vehicle),
        color=r.color,
        status=r.status,
        stops=stops,
        stop_count=len(stops),
        distance_km=r.distance_km,
        estimated_minutes=r.est_minutes,
        baseline_distance_km=r.baseline_distance_km,
        baseline_minutes=r.baseline_minutes,
        time_saved_minutes=max(0, r.baseline_minutes - r.est_minutes),
        progress_pct=r.progress_pct,
        created_at=r.created_at,
        started_at=r.started_at,
        completed_at=r.completed_at,
    )
