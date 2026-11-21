"""Pure-logic tests (no FastAPI/SQLAlchemy needed): `python -m pytest tests/test_logic.py`."""

from app.services.routing import Point, VehicleSpec, haversine_km, plan_routes
from app.services.status import alert_severity, bin_status, clamp_fill


def test_bin_status_boundaries():
    assert [bin_status(x) for x in (0, 49, 50, 79, 80, 99, 100)] == [
        "normal", "normal", "moderate", "moderate", "almost_full", "almost_full", "full",
    ]


def test_alert_severity_boundaries():
    assert alert_severity(79) is None
    assert alert_severity(80) == "warning"
    assert alert_severity(89) == "warning"
    assert alert_severity(90) == "high"
    assert alert_severity(99) == "high"
    assert alert_severity(100) == "critical"


def test_alert_severity_custom_thresholds():
    th = {"warning": 70, "high": 85, "critical": 100}
    assert alert_severity(70, th) == "warning"
    assert alert_severity(85, th) == "high"


def test_clamp():
    assert clamp_fill(-5) == 0 and clamp_fill(140) == 100


def test_haversine_zero_and_symmetry():
    assert haversine_km(10, 10, 10, 10) == 0
    assert abs(haversine_km(12.9, 77.5, 13.0, 77.6) - haversine_km(13.0, 77.6, 12.9, 77.5)) < 1e-9


def _bins(n):
    return [Point(f"BIN-{i:03d}", 12.9 + (i % 5) * 0.01, 77.5 + (i // 5) * 0.01, load_kg=50, fill=90) for i in range(n)]


def test_every_bin_assigned_once_when_capacity_allows():
    bins = _bins(12)
    vehicles = [VehicleSpec("V1", 12.9, 77.5, 1000), VehicleSpec("V2", 13.0, 77.6, 1000)]
    plan = plan_routes(bins, vehicles, depot=(12.95, 77.55))
    ids = [s.id for r in plan.routes for s in r.stops]
    assert sorted(ids) == sorted(b.id for b in bins)
    assert not plan.unassigned


def test_capacity_respected_and_overflow_reported():
    bins = _bins(10)  # 10 * 50kg = 500kg
    plan = plan_routes(bins, [VehicleSpec("V1", 12.9, 77.5, 200)], depot=(12.9, 77.5))
    assert sum(r.load_kg for r in plan.routes) <= 200
    assert len(plan.unassigned) == 6


def test_optimised_never_worse_than_baseline():
    plan = plan_routes(_bins(15), [VehicleSpec("V1", 12.9, 77.5, 5000)], depot=(12.9, 77.5))
    for r in plan.routes:
        assert r.distance_km <= r.baseline_distance_km + 1e-9


def test_no_vehicles_means_all_unassigned():
    plan = plan_routes(_bins(3), [], depot=(0, 0))
    assert plan.routes == [] and len(plan.unassigned) == 3
