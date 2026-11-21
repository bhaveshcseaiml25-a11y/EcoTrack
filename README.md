#  EcoTrack: Smart Waste Management Platform

EcoTrack is a software-only smart waste management system for municipalities. It monitors bin fill levels, raises alerts before bins overflow, plans efficient collection routes, and lets citizens report waste problems through a public complaint portal.

> **Note:** Bin sensors are **simulated** (no IoT hardware) and notifications are **in-app only**. 

##  Features

- **Live dashboard:** city-wide overview of bins, alerts, vehicles and complaints
- **Smart bins:** search, filter and sort bins by area, status and category; simulate fills and resets
- **Automatic alerts:** triggered at configurable thresholds (warning 80%, high 90%, critical 100%), with escalation and auto-resolve
- **Route optimisation:** full bins are assigned to the nearest vehicle with spare capacity and ordered by nearest-neighbour; shows estimated time saved
- **Citizen complaint portal:** submit complaints with an optional photo and track them by ID (e.g. `CMP-2026-00012`)
- **Admin complaint management:** assign workers and update status
- **Analytics:** collection trends, area-wise waste, complaint trends, vehicle performance, efficiency, with CSV export
- **Settings:** configurable alert thresholds and a simulation auto-tick toggle

##  Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js, React 19, TypeScript, Tailwind CSS 4, shadcn/ui |
| Maps & charts | Leaflet / React-Leaflet, Recharts |
| Backend | FastAPI, SQLAlchemy 2, Pydantic 2, Uvicorn |
| Database | SQLite (PostgreSQL supported via `ECOTRACK_DATABASE_URL`) |
| Testing | pytest, httpx |

##  Project Structure

```
EcoTrack/
├── ecotrack-backend/        # FastAPI REST API
│   ├── app/
│   │   ├── main.py          # app, CORS, startup (tables, seed data, background sim)
│   │   ├── models.py        # SQLAlchemy tables
│   │   ├── schemas.py       # Pydantic request/response models
│   │   ├── routers/         # one router per frontend page
│   │   └── services/        # status rules, alerts, routing, simulation, seed data
│   ├── tests/               # logic + end-to-end API tests
│   ├── requirements.txt
│   └── .env.example
└── ecotrack-frontend/       # Next.js app
    ├── app/
    │   ├── (admin)/         # overview, bins, alerts, routes, complaints, analytics, settings
    │   └── citizen/         # public complaint portal
    ├── components/
    └── lib/
```

##  Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18.18+ (20 LTS recommended)
- Free ports **8000** (backend) and **3000** (frontend)

### 1. Run the backend

```bash
cd ecotrack-backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

- API docs: http://localhost:8000/docs
- Health check: http://localhost:8000/health

The SQLite database is created and filled with demo data on first run. To start fresh, delete `ecotrack.db` or call `POST /api/v1/simulation/reseed`.

### 2. Run the frontend

```bash
cd ecotrack-frontend
npm install          # or: pnpm install
npm run dev
```

Open http://localhost:3000. The citizen complaint portal is at http://localhost:3000/citizen.

### 3. Connect frontend to backend

Create `ecotrack-frontend/.env.local`:

```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
```

CORS allows `http://localhost:3000` by default. For other origins, set `ECOTRACK_CORS_ORIGINS` in the backend environment.

##  Configuration (backend)

Copy `.env.example` and set any variables you want to change, for example:

| Variable | Purpose |
|---|---|
| `ECOTRACK_DATABASE_URL` | Use a different database (e.g. PostgreSQL) |
| `ECOTRACK_CORS_ORIGINS` | Allowed frontend origins |
| `ECOTRACK_CITY_LAT` / `ECOTRACK_CITY_LNG` | Centre of the seeded bin coordinates |
| `ECOTRACK_SIM_INTERVAL_SECONDS` | Interval for the background simulation |

##  API Overview (`/api/v1`)

| Area | Key endpoints |
|---|---|
| Dashboard | `GET /dashboard/overview` |
| Bins | `GET /bins`, `GET /bins/{id}`, `POST /bins/{id}/simulate-fill`, `PUT /bins/{id}/fill`, `POST /bins/{id}/reset` |
| Alerts | `GET /alerts`, `POST /alerts/{id}/read`, `POST /alerts/{id}/resolve` |
| Routes | `POST /routes/optimize`, `GET /routes`, `POST /routes/{id}/start`, `POST /routes/{id}/stops/{binId}/collect` |
| Complaints | `POST /complaints`, `GET /complaints/track/{id}`, `GET /complaints`, `PATCH /complaints/{id}` |
| Analytics | `GET /analytics/collection-trend`, `/area-waste`, `/complaints-trend`, `/vehicle-performance`, `/efficiency`, `/report.csv` |
| Settings | `GET /settings`, `PUT /settings` |
| Demo | `POST /simulation/tick`, `POST /simulation/reseed` |

See the interactive docs at `/docs` for the full list.

##  How It Works

- **Status bands:** 0–49% normal, 50–79% moderate, 80–99% almost full, 100% full
- **Alerts:** created when a bin crosses a threshold; a higher severity closes the old alert and opens a new one; dropping below the warning level, resetting or collecting a bin auto-resolves alerts
- **Routing:** greedy assignment to the nearest vehicle with capacity, nearest-neighbour ordering, straight-line distances at a fixed 25 km/h with 4 min per stop. The solver lives in `app/services/routing.py` and can be swapped for a real one

##  Tests

```bash
cd ecotrack-backend
python -m pytest
```

##  Known Limitations / Roadmap

- [ ] Authentication and role-based access (admin endpoints are currently open)
- [ ] Database migrations (Alembic)
- [ ] Rate limiting and malware scanning for image uploads
- [ ] Real road-network routing engine
- [ ] Real sensor / IoT data ingestion
- [ ] Real SMS / email notifications

##  team
pc.sarvesa
p.yuvaraj
bhavesh.v.s
