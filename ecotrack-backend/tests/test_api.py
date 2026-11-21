"""End-to-end API tests. Need the full requirements installed: `python -m pytest`."""

import pytest
from fastapi.testclient import TestClient

from app.main import app

API = "/api/v1"


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_health_and_overview(client):
    assert client.get("/health").json() == {"status": "ok"}
    data = client.get(f"{API}/dashboard/overview").json()
    assert data["stats"]["totalBins"] == 48
    assert len(data["fillDistribution"]) == 4


def test_bin_filters(client):
    r = client.get(f"{API}/bins", params={"status": "full"}).json()
    assert all(b["fillLevel"] == 100 for b in r["items"])
    r = client.get(f"{API}/bins", params={"area": "Downtown"}).json()
    assert r["total"] == 8


def test_simulate_fill_creates_and_escalates_alert(client):
    client.post(f"{API}/simulation/reseed")
    client.put(f"{API}/bins/BIN-001/fill", json={"fillLevel": 10})
    res = client.put(f"{API}/bins/BIN-001/fill", json={"fillLevel": 85}).json()
    assert res["bin"]["status"] == "almost_full"
    assert res["newAlert"]["severity"] == "warning"
    res = client.put(f"{API}/bins/BIN-001/fill", json={"fillLevel": 100}).json()
    assert res["newAlert"]["severity"] == "critical"
    res = client.post(f"{API}/bins/BIN-001/reset").json()
    assert res["bin"]["fillLevel"] == 0
    open_alerts = client.get(f"{API}/alerts", params={"status": "unread"}).json()["items"]
    assert all(a["binId"] != "BIN-001" for a in open_alerts)


def test_alert_read_and_resolve(client):
    items = client.get(f"{API}/alerts", params={"status": "unread"}).json()["items"]
    assert items
    aid = items[0]["id"]
    assert client.post(f"{API}/alerts/{aid}/read").json()["notificationStatus"] == "read"
    assert client.post(f"{API}/alerts/{aid}/resolve").json()["notificationStatus"] == "resolved"


def test_route_optimise_and_collect(client):
    res = client.post(f"{API}/routes/optimize").json()
    assert res["simulated"] is True and res["routes"]
    route = res["routes"][0]
    stop = route["stops"][0]
    out = client.post(f"{API}/routes/{route['id']}/stops/{stop['binId']}/collect").json()
    assert out["bin"]["fillLevel"] == 0
    assert out["route"]["progressPct"] > 0


def test_complaint_flow(client):
    form = {
        "name": "Test Citizen", "contact": "t@example.com", "category": "Illegal dumping",
        "description": "Rubble dumped on the corner.", "location": "Market St",
    }
    r = client.post(f"{API}/complaints", data=form)
    assert r.status_code == 201
    code = r.json()["id"]
    assert code.startswith("CMP-")
    assert client.get(f"{API}/complaints/track/{code}").json()["status"] == "submitted"
    # assigning/resolving needs a worker
    assert client.patch(f"{API}/complaints/{code}", json={"status": "resolved"}).status_code == 422
    wid = client.get(f"{API}/workers").json()[0]["id"]
    r = client.patch(f"{API}/complaints/{code}", json={"assignedWorkerId": wid}).json()
    assert r["status"] == "assigned"


def test_bad_complaint_category_and_image(client):
    form = {"name": "X Y", "contact": "x@y.com", "category": "Nope", "description": "long enough text", "location": "Here"}
    assert client.post(f"{API}/complaints", data=form).status_code == 422
    form["category"] = "Other"
    files = {"image": ("a.exe", b"MZ", "application/octet-stream")}
    assert client.post(f"{API}/complaints", data=form, files=files).status_code == 415


def test_settings_validation(client):
    s = client.get(f"{API}/settings").json()
    s["thresholds"] = {"warning": 95, "high": 90, "critical": 100}
    assert client.put(f"{API}/settings", json=s).status_code == 422


def test_analytics(client):
    assert client.get(f"{API}/analytics/collection-trend", params={"granularity": "weekly"}).json()["points"]
    assert client.get(f"{API}/analytics/report.csv").headers["content-type"].startswith("text/csv")
