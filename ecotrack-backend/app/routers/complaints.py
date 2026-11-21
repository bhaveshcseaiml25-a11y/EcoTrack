import re
import uuid
from datetime import datetime
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.config import settings as cfg
from app.constants import COMPLAINT_CATEGORIES
from app.database import get_db
from app.models import Complaint, Worker, utcnow
from app.presenters import complaint_out
from app.schemas import (
    CitizenComplaintStatus,
    ComplaintList,
    ComplaintOut,
    ComplaintUpdateIn,
    WorkerOut,
)

router = APIRouter(tags=["Citizen complaints"])

ALLOWED_IMAGE_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp"}
CODE_RE = re.compile(r"^CMP-\d{4}-\d{5}$")


def _by_code(db: Session, code: str) -> Complaint:
    c = db.scalar(
        select(Complaint).options(joinedload(Complaint.assigned_worker)).where(Complaint.code == code)
    )
    if not c:
        raise HTTPException(404, f"Complaint {code} not found")
    return c


@router.get("/workers", response_model=list[WorkerOut])
def list_workers(db: Session = Depends(get_db)):
    return [WorkerOut.model_validate(w) for w in db.scalars(select(Worker).order_by(Worker.name))]


@router.get("/complaints/meta")
def complaint_meta():
    return {
        "categories": COMPLAINT_CATEGORIES,
        "statuses": ["submitted", "under_review", "assigned", "resolved"],
    }


@router.post("/complaints", response_model=ComplaintOut, status_code=201)
async def submit_complaint(
    name: str = Form(..., min_length=2, max_length=100),
    contact: str = Form(..., min_length=5, max_length=120),
    category: str = Form(...),
    description: str = Form(..., min_length=10, max_length=2000),
    location: str = Form(..., min_length=3, max_length=200),
    latitude: float | None = Form(None, ge=-90, le=90),
    longitude: float | None = Form(None, ge=-180, le=180),
    image: UploadFile | None = File(None),
    db: Session = Depends(get_db),
):
    """Citizen submission (multipart/form-data). Returns the generated complaint ID."""
    if category not in COMPLAINT_CATEGORIES:
        raise HTTPException(422, f"category must be one of {COMPLAINT_CATEGORIES}")

    image_name = None
    if image is not None and image.filename:
        ext = ALLOWED_IMAGE_TYPES.get(image.content_type or "")
        if not ext:
            raise HTTPException(415, "Image must be JPEG, PNG or WebP")
        data = await image.read(cfg.max_upload_bytes + 1)
        if len(data) > cfg.max_upload_bytes:
            raise HTTPException(413, f"Image larger than {cfg.max_upload_bytes // (1024 * 1024)} MB")
        upload_dir = Path(cfg.upload_dir)
        upload_dir.mkdir(parents=True, exist_ok=True)
        image_name = f"{uuid.uuid4().hex}{ext}"  # never trust the client filename
        (upload_dir / image_name).write_bytes(data)

    c = Complaint(
        code=f"TMP-{uuid.uuid4().hex[:20]}",
        name=name.strip(),
        contact=contact.strip(),
        category=category,
        description=description.strip(),
        location=location.strip(),
        latitude=latitude,
        longitude=longitude,
        image_path=image_name,
    )
    db.add(c)
    db.flush()
    c.code = f"CMP-{utcnow().year}-{c.id:05d}"
    db.commit()
    return complaint_out(c)


@router.get("/complaints", response_model=ComplaintList)
def list_complaints(
    search: str | None = Query(None, description="Matches ID, name, location or description"),
    status: str | None = Query(None, pattern="^(submitted|under_review|assigned|resolved)$"),
    category: str | None = None,
    assigned_worker_id: int | None = Query(None, alias="assignedWorkerId"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """Admin list."""
    q = select(Complaint).options(joinedload(Complaint.assigned_worker))
    if search:
        like = f"%{search.strip()}%"
        q = q.where(
            or_(
                Complaint.code.ilike(like),
                Complaint.name.ilike(like),
                Complaint.location.ilike(like),
                Complaint.description.ilike(like),
            )
        )
    if status:
        q = q.where(Complaint.status == status)
    if category:
        q = q.where(Complaint.category == category)
    if assigned_worker_id:
        q = q.where(Complaint.assigned_worker_id == assigned_worker_id)

    total = db.scalar(select(func.count()).select_from(q.order_by(None).subquery())) or 0
    rows = db.scalars(q.order_by(Complaint.created_at.desc()).limit(limit).offset(offset)).all()
    return ComplaintList(items=[complaint_out(c) for c in rows], total=total)


@router.get("/complaints/track/{code}", response_model=CitizenComplaintStatus)
def track_complaint(code: str, db: Session = Depends(get_db)):
    """Citizen status lookup by complaint ID. Returns no personal details."""
    code = code.strip().upper()
    if not CODE_RE.match(code):
        raise HTTPException(422, "Complaint ID looks like CMP-2026-00012")
    c = _by_code(db, code)
    return CitizenComplaintStatus(
        id=c.code, category=c.category, location=c.location, status=c.status,
        created_at=c.created_at, updated_at=c.updated_at,
    )


@router.get("/complaints/{code}", response_model=ComplaintOut)
def get_complaint(code: str, db: Session = Depends(get_db)):
    return complaint_out(_by_code(db, code))


@router.patch("/complaints/{code}", response_model=ComplaintOut)
def update_complaint(code: str, body: ComplaintUpdateIn, db: Session = Depends(get_db)):
    """Admin: change status and/or assign a worker."""
    c = _by_code(db, code)

    if body.assigned_worker_id is not None:
        if not db.get(Worker, body.assigned_worker_id):
            raise HTTPException(404, "Worker not found")
        c.assigned_worker_id = body.assigned_worker_id
        if body.status is None and c.status in ("submitted", "under_review"):
            c.status = "assigned"

    if body.status is not None:
        if body.status in ("assigned", "resolved") and c.assigned_worker_id is None:
            raise HTTPException(422, "Assign a worker before setting this status")
        c.status = body.status

    c.resolved_at = utcnow() if c.status == "resolved" else None
    db.commit()
    db.refresh(c)
    return complaint_out(_by_code(db, code))
