import copy

from sqlalchemy.orm import Session

from app.constants import DEFAULT_APP_SETTINGS
from app.models import AppSetting

KEY = "app"


def _merge(base: dict, override: dict) -> dict:
    out = copy.deepcopy(base)
    for k, v in override.items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = _merge(out[k], v)
        else:
            out[k] = v
    return out


def get_settings(db: Session) -> dict:
    row = db.get(AppSetting, KEY)
    stored = row.value if row else {}
    return _merge(DEFAULT_APP_SETTINGS, stored)


def save_settings(db: Session, value: dict) -> dict:
    row = db.get(AppSetting, KEY)
    if row is None:
        row = AppSetting(key=KEY, value=value)
        db.add(row)
    else:
        row.value = value
    db.commit()
    return get_settings(db)


def get_thresholds(db: Session) -> dict:
    return get_settings(db)["thresholds"]
