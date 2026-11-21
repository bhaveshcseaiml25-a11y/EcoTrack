  # EcoTrack Backend (FastAPI)

REST API for the EcoTrack smart waste management frontend (Next.js). Bin fill levels are **simulated** (no IoT hardware) and notifications are **in-app only** (no real SMS/email).

## Prerequisites

| Requirement | Version | Notes |
|---|---|---|
| Python | 3.10+ (developed on 3.13) | `python --version` |
| pip + venv | bundled with Python | On Debian/Ubuntu: `sudo apt install python3-venv` |
| Internet access (first install only) | – | To download packages from PyPI |
| Free port | 8000 | Backend. The frontend runs on 3000 |
| Node.js | 18.18+ (20 LTS recommended) | Only for the Next.js frontend, not the backend |
| Git | any | Optional |

Python packages (see `requirements.txt`): `fastapi`, `uvicorn[standard]`, `sqlalchemy` 2.x, `pydantic` 2.x, `python-multipart` (needed for complaint image upload), plus `pytest` and `httpx` for tests.

**No database server is needed.** It uses SQLite (a file, `ecotrack.db`, created on first run and filled with demo data). To use PostgreSQL later, install `psycopg[binary]` and set `ECOTRACK_DATABASE_URL`.

## Run it

```bash
cd ecotrack-backend
python -m venv .venv
source .venv/bin/activate            # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# optional: copy .env.example and export the variables you want to change
uvicorn app.main:app --reload --port 8000
```

- Interactive API docs: http://localhost:8000/docs
- Health check: http://localhost:8000/health
- Reset the demo data any time: `POST /api/v1/simulation/reseed`

Delete `ecotrack.db` to start from scratch.

## Connecting the frontend

1. In the Next.js app add `.env.local`: `NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1`
2. Replace the mock-data calls with `fetch` calls to the endpoints below (JSON is **camelCase**, timestamps are ISO-8601 UTC with `Z`).
3. CORS allows `http://localhost:3000` by default; change `ECOTRACK_CORS_ORIGINS` for other origins.
4. Seed coordinates are generated around `ECOTRACK_CITY_LAT/LNG`. Set these to the centre of your frontend map.

## Endpoints (`/api/v1`)

| Frontend page | Endpoints |
|---|---|
| Overview | `GET /dashboard/overview` |
| Smart bins | `GET /bins?search&area&status&category&sort&limit&offset`, `GET /bins/meta`, `GET /bins/{id}`, `POST /bins/{id}/simulate-fill` (`{"amount":10}`), `PUT /bins/{id}/fill` (`{"fillLevel":85}`), `POST /bins/{id}/reset` |
| Alerts | `GET /alerts?severity&status=unread\|read\|resolved` (no filter = notification history), `GET /alerts/unread-count`, `POST /alerts/{id}/read`, `POST /alerts/read-all`, `POST /alerts/{id}/resolve` |
| Routes | `GET /vehicles`, `PATCH /vehicles/{id}/status`, `POST /routes/optimize`, `GET /routes`, `GET /routes/summary`, `GET /routes/{id}`, `POST /routes/{id}/start`, `POST /routes/{id}/stops/{binId}/collect` |
| Complaints (citizen) | `POST /complaints` (multipart form, optional `image`), `GET /complaints/track/{id}` (no personal data), `GET /complaints/meta` |
| Complaints (admin) | `GET /complaints?search&status&category&assignedWorkerId`, `GET /complaints/{id}`, `PATCH /complaints/{id}` (`status`, `assignedWorkerId`), `GET /workers` |
| Analytics | `GET /analytics/collection-trend?from&to&granularity=daily\|weekly\|monthly`, `/analytics/area-waste`, `/analytics/complaints-trend`, `/analytics/vehicle-performance`, `/analytics/efficiency`, `/analytics/fill-distribution`, `/analytics/report.csv` |
| Settings | `GET /settings`, `PUT /settings` |
| Demo | `POST /simulation/tick` (advance sensors once), `POST /simulation/reseed` |

Uploaded complaint images are served at `/uploads/<file>`; the `imageUrl` field is relative to the backend host.

## How it behaves

- **Status bands:** 0–49 normal, 50–79 moderate, 80–99 almost full, 100 full.
- **Alerts:** created automatically whenever a bin update crosses the configured thresholds (default warning 80, high 90, critical 100). Going to a higher severity closes the old alert and opens a new one. Dropping below the warning threshold, resetting or collecting a bin auto-resolves its open alerts.
- **Route optimisation (simulated):** bins at/above the warning threshold are grouped greedily onto the nearest vehicle with spare capacity, then ordered by nearest-neighbour. Distances are straight-line, with a fixed 25 km/h and 4 min per stop. "Time saved" compares against visiting the same bins in ID order. Every response carries `simulated: true`. Replace `app/services/routing.py::plan_routes` with a real solver later; the rest of the app does not change.
- **Auto simulation:** turn on `system.simulationAutoTick` in Settings and a background task raises a few random bins every `ECOTRACK_SIM_INTERVAL_SECONDS`.
- **Complaints:** IDs look like `CMP-2026-00012`. Setting status `assigned` or `resolved` requires an assigned worker. Images: JPEG/PNG/WebP, max 5 MB.

## Layout

```
app/
  main.py            app, CORS, lifespan (create tables, seed, background sim)
  models.py          SQLAlchemy tables
  schemas.py         Pydantic request/response models (camelCase)
  presenters.py      ORM -> schema helpers
  routers/           one file per frontend page
  services/
    status.py        fill -> status / alert severity rules (pure)
    alerts.py        alert create / escalate / auto-resolve
    routing.py       route planning (pure, swappable)
    simulation.py    fake sensor updates
    seed.py          demo data (fictional city "Greenvale")
tests/
  test_logic.py      rules + routing, no framework needed
  test_api.py        end-to-end API tests
```

## Tests

```bash
python -m pytest
```

## Not included yet (needed before real deployment)

- **Authentication / roles.** Admin endpoints (alerts, complaints list, settings, simulation) are open. Add login + role checks (e.g. JWT) so citizens can only reach `POST /complaints` and `GET /complaints/track/{id}`.
- Database migrations (Alembic). Tables are created automatically, which is fine for a demo.
- Rate limiting and malware scanning for uploads.
- Real routing engine (road network) and real sensor ingestion.
