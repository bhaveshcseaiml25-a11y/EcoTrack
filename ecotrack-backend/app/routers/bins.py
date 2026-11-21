from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.constants import BIN_STATUSES, WASTE_CATEGORIES
from app.database import get_db
from app.models import Bin
from app.presenters import alert_out
from app.schemas import BinList, BinMeta, BinOut, BinUpdateResult, SetFillIn, SimulateFillIn
from app.services.alerts import set_fill_level
from app.services.status import status_range

router = APIRouter(prefix="/bins", tags=["Smart bins"])


def _get_bin(db: Session, bin_id: str) -> Bin:
    b = db.get(Bin, bin_id)
    if not b:
        raise HTTPException(404, f"Bin {bin_id} not found")
    return b


def _result(db: Session, b: Bin, alert) -> BinUpdateResult:
    new_alert = None
    if alert:
        db.refresh(alert)
        new_alert = alert_out(alert)
    return BinUpdateResult(bin=BinOut.model_validate(b), new_alert=new_alert)


@router.get("", response_model=BinList)
def list_bins(
    search: str | None = Query(None, description="Matches bin id, location or area"),
    area: str | None = None,
    status: str | None = Query(None, pattern="^(normal|moderate|almost_full|full)$"),
    category: str | None = None,
    sort: str = Query("id", pattern="^(id|fill|updated)$"),
    limit: int = Query(200, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    q = select(Bin)
    if search:
        like = f"%{search.strip()}%"
        q = q.where(or_(Bin.id.ilike(like), Bin.location.ilike(like), Bin.area.ilike(like)))
    if area:
        q = q.where(Bin.area == area)
    if category:
        q = q.where(Bin.category == category)
    if status:
        lo, hi = status_range(status)
        q = q.where(Bin.fill_level.between(lo, hi))

    total = db.scalar(select(func.count()).select_from(q.subquery()))
    order = {"id": Bin.id.asc(), "fill": Bin.fill_level.desc(), "updated": Bin.last_updated.desc()}[sort]
    items = db.scalars(q.order_by(order).limit(limit).offset(offset)).all()
    return BinList(items=[BinOut.model_validate(b) for b in items], total=total or 0)


@router.get("/meta", response_model=BinMeta)
def bin_meta(db: Session = Depends(get_db)):
    areas = db.scalars(select(Bin.area).distinct().order_by(Bin.area)).all()
    return BinMeta(areas=list(areas), categories=WASTE_CATEGORIES, statuses=BIN_STATUSES)


@router.get("/{bin_id}", response_model=BinOut)
def get_bin(bin_id: str, db: Session = Depends(get_db)):
    return BinOut.model_validate(_get_bin(db, bin_id))


@router.post("/{bin_id}/simulate-fill", response_model=BinUpdateResult)
def simulate_fill(bin_id: str, body: SimulateFillIn | None = None, db: Session = Depends(get_db)):
    """Demo: raise a bin's fill level by `amount` percentage points (default 10)."""
    b = _get_bin(db, bin_id)
    amount = body.amount if body else 10
    alert = set_fill_level(db, b, b.fill_level + amount)
    return _result(db, b, alert)


@router.put("/{bin_id}/fill", response_model=BinUpdateResult)
def set_fill(bin_id: str, body: SetFillIn, db: Session = Depends(get_db)):
    """Demo: set an exact fill level (0-100)."""
    b = _get_bin(db, bin_id)
    alert = set_fill_level(db, b, body.fill_level)
    return _result(db, b, alert)


@router.post("/{bin_id}/reset", response_model=BinUpdateResult)
def reset_bin(bin_id: str, db: Session = Depends(get_db)):
    """Demo: empty the bin; any open alerts for it are auto-resolved."""
    b = _get_bin(db, bin_id)
    alert = set_fill_level(db, b, 0, resolution_note="Manual reset")
    return _result(db, b, alert)
