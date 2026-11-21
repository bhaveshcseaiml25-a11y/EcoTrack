from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, select
from sqlalchemy.orm import Session, joinedload

from app.config import settings as cfg
from app.constants import ROUTE_COLORS
from app.database import get_db
from app.models import Bin, CollectionLog, Route, RouteStop, Vehicle, utcnow
from app.presenters import route_out
from app.schemas import (
    BinOut,
    CollectResult,
    OptimizeResult,
    RouteOut,
    RouteSummary,
    VehicleOut,
    VehicleStatusIn,
)
from app.services import routing
from app.services.alerts import set_fill_level
from app.services.settings_service import get_thresholds

router = APIRouter(tags=["Route optimisation"])

_route_query = select(Route).options(
    joinedload(Route.vehicle), joinedload(Route.stops).joinedload(RouteStop.bin)
)


def _load_route(db: Session, route_id: int) -> Route:
    r = db.execute(_route_query.where(Route.id == route_id)).unique().scalar_one_or_none()
    if not r:
        raise HTTPException(404, f"Route {route_id} not found")
    return r


def _summary(routes: list[Route]) -> RouteSummary:
    return RouteSummary(
        total_vehicles_assigned=len({r.vehicle_id for r in routes}),
        total_bins_scheduled=sum(len(r.stops) for r in routes),
        estimated_total_distance_km=round(sum(r.distance_km for r in routes), 1),
        estimated_time_saved_minutes=sum(max(0, r.baseline_minutes - r.est_minutes) for r in routes),
    )


@router.get("/vehicles", response_model=list[VehicleOut])
def list_vehicles(db: Session = Depends(get_db)):
    return [VehicleOut.model_validate(v) for v in db.scalars(select(Vehicle).order_by(Vehicle.id))]


@router.patch("/vehicles/{vehicle_id}/status", response_model=VehicleOut)
def set_vehicle_status(vehicle_id: str, body: VehicleStatusIn, db: Session = Depends(get_db)):
    v = db.get(Vehicle, vehicle_id)
    if not v:
        raise HTTPException(404, "Vehicle not found")
    busy = db.scalar(select(Route.id).where(Route.vehicle_id == v.id, Route.status == "in_progress"))
    if busy:
        raise HTTPException(409, "Vehicle has a route in progress")
    v.status = body.status
    db.commit()
    return VehicleOut.model_validate(v)


@router.get("/routes", response_model=list[RouteOut])
def list_routes(db: Session = Depends(get_db)):
    rows = db.execute(_route_query.order_by(Route.id)).unique().scalars().all()
    return [route_out(r) for r in rows if r.status != "completed"]


@router.get("/routes/summary", response_model=RouteSummary)
def routes_summary(db: Session = Depends(get_db)):
    rows = db.execute(_route_query).unique().scalars().all()
    return _summary([r for r in rows if r.status != "completed"])


@router.post("/routes/optimize", response_model=OptimizeResult)
def optimize_routes(db: Session = Depends(get_db)):
    """Simulated optimisation: group bins at/above the warning threshold into per-vehicle routes.

    Replaces any routes that have not started yet. Routes in progress are left alone and
    their bins are excluded from the new plan.
    """
    db.execute(
        delete(RouteStop).where(RouteStop.route_id.in_(select(Route.id).where(Route.status == "planned")))
    )
    db.execute(delete(Route).where(Route.status == "planned"))
    db.flush()

    in_progress = db.execute(_route_query.where(Route.status == "in_progress")).unique().scalars().all()
    busy_vehicles = {r.vehicle_id for r in in_progress}
    busy_bins = {s.bin_id for r in in_progress for s in r.stops if not s.collected}

    warning = get_thresholds(db)["warning"]
    bins = db.scalars(select(Bin).where(Bin.fill_level >= warning)).all()
    points = [
        routing.Point(b.id, b.latitude, b.longitude, load_kg=b.load_kg, fill=b.fill_level)
        for b in bins
        if b.id not in busy_bins
    ]
    vehicles = db.scalars(select(Vehicle).where(Vehicle.status != "maintenance")).all()
    specs = [
        routing.VehicleSpec(v.id, v.latitude, v.longitude, v.capacity_kg)
        for v in vehicles
        if v.id not in busy_vehicles
    ]

    plan = routing.plan_routes(points, specs, depot=(cfg.city_lat, cfg.city_lng))

    created: list[Route] = []
    for i, pr in enumerate(plan.routes):
        route = Route(
            vehicle_id=pr.vehicle_id,
            color=ROUTE_COLORS[i % len(ROUTE_COLORS)],
            status="planned",
            distance_km=pr.distance_km,
            est_minutes=pr.est_minutes,
            baseline_distance_km=pr.baseline_distance_km,
            baseline_minutes=pr.baseline_minutes,
            stops=[
                RouteStop(bin_id=s.id, sequence=n + 1, load_kg=s.load_kg) for n, s in enumerate(pr.stops)
            ],
        )
        db.add(route)
        created.append(route)
    db.commit()

    fresh = [_load_route(db, r.id) for r in created]
    return OptimizeResult(
        routes=[route_out(r) for r in fresh],
        summary=_summary(fresh),
        unassigned_bin_ids=[p.id for p in plan.unassigned],
    )


@router.get("/routes/{route_id}", response_model=RouteOut)
def get_route(route_id: int, db: Session = Depends(get_db)):
    return route_out(_load_route(db, route_id))


@router.post("/routes/{route_id}/start", response_model=RouteOut)
def start_route(route_id: int, db: Session = Depends(get_db)):
    r = _load_route(db, route_id)
    if r.status == "completed":
        raise HTTPException(409, "Route already completed")
    if r.status == "planned":
        r.status, r.started_at = "in_progress", utcnow()
        r.vehicle.status = "active"
        db.commit()
    return route_out(r)


@router.post("/routes/{route_id}/stops/{bin_id}/collect", response_model=CollectResult)
def collect_stop(route_id: int, bin_id: str, db: Session = Depends(get_db)):
    """Mark a stop collected: empties the bin, logs the pickup, resolves its alerts."""
    r = _load_route(db, route_id)
    stop = next((s for s in r.stops if s.bin_id == bin_id), None)
    if not stop:
        raise HTTPException(404, f"Bin {bin_id} is not on route {route_id}")
    if r.status == "completed":
        raise HTTPException(409, "Route already completed")
    if stop.collected:
        raise HTTPException(409, "Stop already collected")

    now = utcnow()
    if r.status == "planned":
        r.status, r.started_at = "in_progress", now
        r.vehicle.status = "active"

    stop.collected, stop.collected_at = True, now
    db.add(
        CollectionLog(
            bin_id=stop.bin_id,
            area=stop.bin.area,
            vehicle_id=r.vehicle_id,
            kg=stop.load_kg,
            distance_km=round(r.distance_km / max(1, len(r.stops)), 2),
            collected_at=now,
        )
    )
    r.vehicle.latitude, r.vehicle.longitude = stop.bin.latitude, stop.bin.longitude

    if all(s.collected for s in r.stops):
        r.status, r.completed_at = "completed", now
        r.vehicle.status = "available"

    set_fill_level(db, stop.bin, 0, resolution_note="Collected")  # commits
    return CollectResult(route=route_out(r), bin=BinOut.model_validate(stop.bin))
