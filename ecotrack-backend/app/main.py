import asyncio
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app import models  # noqa: F401  (registers tables)
from app.config import settings
from app.database import Base, SessionLocal, engine
from app.routers import alerts, analytics, bins, complaints, dashboard, routes, settings as settings_router, simulation
from app.services.seed import seed_if_empty
from app.services.simulation import auto_tick_loop


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(engine)
    with SessionLocal() as db:
        seed_if_empty(db)
    Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
    task = asyncio.create_task(auto_tick_loop())
    try:
        yield
    finally:
        task.cancel()


app = FastAPI(
    title="EcoTrack API",
    version="1.0.0",
    description="Backend for the EcoTrack smart waste management platform. "
    "Bin fill levels are simulated (no IoT hardware); notifications are in-app only.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

api = APIRouter(prefix="/api/v1")
for r in (
    dashboard.router,
    bins.router,
    alerts.router,
    routes.router,
    complaints.router,
    analytics.router,
    settings_router.router,
    simulation.router,
):
    api.include_router(r)
app.include_router(api)

Path(settings.upload_dir).mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")


@app.get("/health", tags=["System"])
def health():
    return {"status": "ok"}
