from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import AppSettings
from app.services import settings_service

router = APIRouter(prefix="/settings", tags=["Settings"])


@router.get("", response_model=AppSettings)
def read_settings(db: Session = Depends(get_db)):
    return AppSettings.model_validate(settings_service.get_settings(db))


@router.put("", response_model=AppSettings)
def update_settings(body: AppSettings, db: Session = Depends(get_db)):
    """Replace all settings. Alert thresholds apply to future bin updates and route planning."""
    saved = settings_service.save_settings(db, body.model_dump(by_alias=True))
    return AppSettings.model_validate(saved)
