"""Simulated sensor readings. No IoT hardware exists; fill levels are generated here."""

import asyncio
import logging
import random

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings as cfg
from app.database import SessionLocal
from app.models import Alert, Bin
from app.services.alerts import set_fill_level
from app.services.settings_service import get_settings

log = logging.getLogger("ecotrack.simulation")


def tick(db: Session, rng: random.Random | None = None, bins_to_update: int = 5) -> dict:
    """Raise the fill level of a few random bins (never above 100)."""
    rng = rng or random.Random()
    candidates = db.scalars(select(Bin).where(Bin.fill_level < 100)).all()
    chosen = rng.sample(candidates, min(bins_to_update, len(candidates)))
    new_alerts: list[Alert] = []
    for b in chosen:
        alert = set_fill_level(db, b, b.fill_level + rng.randint(3, 15))
        if alert:
            new_alerts.append(alert)
    return {"updatedBins": [b.id for b in chosen], "newAlerts": new_alerts}


async def auto_tick_loop() -> None:
    """Runs forever; only acts when Settings > System > simulationAutoTick is on."""
    while True:
        await asyncio.sleep(cfg.sim_interval_seconds)
        try:
            with SessionLocal() as db:
                if get_settings(db)["system"].get("simulationAutoTick"):
                    tick(db)
        except Exception:  # keep the loop alive
            log.exception("simulation tick failed")
