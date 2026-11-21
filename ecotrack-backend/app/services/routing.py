"""Route planning. Pure Python (no DB), so a real solver can replace this module.

The current algorithm is a heuristic, NOT an exact optimiser:
  1. Bins are taken most-full first and given to the nearest vehicle that still
     has capacity (greedy clustering).
  2. Each vehicle's stops are ordered with nearest-neighbour from its position.
  3. Distances are straight-line (haversine); times assume a fixed average speed
     and a fixed service time per stop. All results are therefore estimates.

To integrate OR-Tools / OSRM / a VRP service later, keep the `plan_routes`
signature and return type and swap the body.
"""

from dataclasses import dataclass, field
from math import asin, cos, radians, sin, sqrt

EARTH_RADIUS_KM = 6371.0088


@dataclass(frozen=True)
class Point:
    id: str
    lat: float
    lng: float
    load_kg: float = 0.0
    fill: int = 0


@dataclass(frozen=True)
class VehicleSpec:
    id: str
    lat: float
    lng: float
    capacity_kg: float


@dataclass
class PlannedRoute:
    vehicle_id: str
    stops: list[Point]
    distance_km: float
    est_minutes: int
    baseline_distance_km: float
    baseline_minutes: int
    load_kg: float = 0.0


@dataclass
class PlanResult:
    routes: list[PlannedRoute] = field(default_factory=list)
    unassigned: list[Point] = field(default_factory=list)


def haversine_km(a_lat: float, a_lng: float, b_lat: float, b_lng: float) -> float:
    dlat = radians(b_lat - a_lat)
    dlng = radians(b_lng - a_lng)
    h = sin(dlat / 2) ** 2 + cos(radians(a_lat)) * cos(radians(b_lat)) * sin(dlng / 2) ** 2
    return 2 * EARTH_RADIUS_KM * asin(sqrt(h))


def path_distance_km(start: tuple[float, float], stops: list[Point], end: tuple[float, float]) -> float:
    pts = [start] + [(s.lat, s.lng) for s in stops] + [end]
    return sum(haversine_km(*pts[i], *pts[i + 1]) for i in range(len(pts) - 1))


def order_nearest_neighbour(start: tuple[float, float], stops: list[Point]) -> list[Point]:
    remaining = list(stops)
    ordered: list[Point] = []
    here = start
    while remaining:
        nxt = min(remaining, key=lambda p: haversine_km(here[0], here[1], p.lat, p.lng))
        remaining.remove(nxt)
        ordered.append(nxt)
        here = (nxt.lat, nxt.lng)
    return ordered


def estimate_minutes(distance_km: float, n_stops: int, avg_speed_kmh: float, minutes_per_stop: float) -> int:
    return round(distance_km / avg_speed_kmh * 60 + n_stops * minutes_per_stop)


def plan_routes(
    bins: list[Point],
    vehicles: list[VehicleSpec],
    depot: tuple[float, float],
    avg_speed_kmh: float = 25.0,
    minutes_per_stop: float = 4.0,
) -> PlanResult:
    result = PlanResult()
    if not vehicles:
        result.unassigned = list(bins)
        return result

    remaining_cap = {v.id: v.capacity_kg for v in vehicles}
    anchor = {v.id: (v.lat, v.lng) for v in vehicles}
    assigned: dict[str, list[Point]] = {v.id: [] for v in vehicles}

    for b in sorted(bins, key=lambda p: (-p.fill, -p.load_kg, p.id)):
        candidates = [v for v in vehicles if remaining_cap[v.id] >= b.load_kg]
        if not candidates:
            result.unassigned.append(b)
            continue
        best = min(candidates, key=lambda v: haversine_km(anchor[v.id][0], anchor[v.id][1], b.lat, b.lng))
        assigned[best.id].append(b)
        remaining_cap[best.id] -= b.load_kg
        anchor[best.id] = (b.lat, b.lng)

    by_id = {v.id: v for v in vehicles}
    for vid, stops in assigned.items():
        if not stops:
            continue
        start = (by_id[vid].lat, by_id[vid].lng)

        # "Baseline" = visiting the same bins in plain ID order (an unplanned run).
        baseline_order = sorted(stops, key=lambda p: p.id)
        baseline_km = path_distance_km(start, baseline_order, depot)

        nn_order = order_nearest_neighbour(start, stops)
        nn_km = path_distance_km(start, nn_order, depot)
        # Never present a plan that is worse than the baseline.
        if nn_km <= baseline_km:
            ordered, dist = nn_order, nn_km
        else:
            ordered, dist = baseline_order, baseline_km

        result.routes.append(
            PlannedRoute(
                vehicle_id=vid,
                stops=ordered,
                distance_km=round(dist, 2),
                est_minutes=estimate_minutes(dist, len(ordered), avg_speed_kmh, minutes_per_stop),
                baseline_distance_km=round(baseline_km, 2),
                baseline_minutes=estimate_minutes(baseline_km, len(ordered), avg_speed_kmh, minutes_per_stop),
                load_kg=round(sum(s.load_kg for s in ordered), 1),
            )
        )
    return result
