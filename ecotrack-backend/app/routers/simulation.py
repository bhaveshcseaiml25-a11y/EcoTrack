from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.presenters import alert_out
from app.schemas import TickResult
from app.services import seed, simulation

router = APIRouter(prefix="/simulation", tags=["Simulation (demo)"])


@router.post("/tick", response_model=TickResult)
def run_tick(db: Session = Depends(get_db)):
    """Advance the simulated sensors once (a few random bins get fuller)."""
    res = simulation.tick(db)
    for a in res["newAlerts"]:
        db.refresh(a)
    return TickResult(updated_bins=res["updatedBins"], new_alerts=[alert_out(a) for a in res["newAlerts"]])


@router.post("/reseed")
def reseed_demo_data(db: Session = Depends(get_db)):
    """Wipe and regenerate all demo data (settings are kept)."""
    seed.reseed(db)
    return {"status": "ok"}
