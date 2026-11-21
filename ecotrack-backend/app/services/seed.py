"""Deterministic demo data for the fictional city of Greenvale."""

import random
from datetime import timedelta

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.config import settings as cfg
from app.constants import COMPLAINT_CATEGORIES, WASTE_CATEGORIES
from app.models import (
    Alert,
    AppSetting,
    Bin,
    CollectionLog,
    Complaint,
    Route,
    RouteStop,
    Vehicle,
    Worker,
    utcnow,
)
from app.services.alerts import sync_alerts_for_bin

# area -> (lat offset, lng offset, street names)
AREAS = {
    "Downtown": (0.000, 0.000, ["Central Ave", "Market St", "Civic Plaza", "Station Rd"]),
    "Riverside": (-0.025, 0.020, ["Riverwalk", "Bridge St", "Willow Lane", "Ferry Rd"]),
    "Hillcrest": (0.030, -0.015, ["Summit Rd", "Orchard Way", "Hilltop Dr", "Cedar Ct"]),
    "Harbor District": (-0.030, -0.030, ["Dock St", "Pier Rd", "Marina Blvd", "Cargo Way"]),
    "University Park": (0.020, 0.030, ["College Ave", "Library Ln", "Campus Dr", "Scholar St"]),
    "Industrial Zone": (0.040, 0.010, ["Foundry Rd", "Depot St", "Mill Lane", "Factory Row"]),
}

VEHICLES = [
    ("VEH-01", "Compactor Alpha", "Ravi Kumar"),
    ("VEH-02", "Compactor Beta", "Anita Sharma"),
    ("VEH-03", "Compactor Gamma", "Joseph Mathew"),
    ("VEH-04", "Compactor Delta", "Meera Nair"),
    ("VEH-05", "Compactor Epsilon", "Imran Sheikh"),
]

WORKERS = [
    ("Suresh Patel", "Sanitation"),
    ("Lakshmi Rao", "Sanitation"),
    ("Daniel Pereira", "Field Inspection"),
    ("Farah Khan", "Field Inspection"),
    ("Vikram Singh", "Bin Maintenance"),
]

SAMPLE_COMPLAINTS = [
    ("Overflowing garbage bin", "Bin near the bus stop has been overflowing since yesterday.", "Central Ave, Downtown"),
    ("Irregular garbage collection", "Our street has not been cleared for five days.", "Willow Lane, Riverside"),
    ("Illegal dumping", "Construction debris dumped behind the market.", "Market St, Downtown"),
    ("Damaged garbage bin", "Lid is broken and the bin leaks.", "Summit Rd, Hillcrest"),
    ("Overflowing garbage bin", "Smell and flies, needs urgent pickup.", "Dock St, Harbor District"),
    ("Other", "Request for an additional recycling bin.", "Campus Dr, University Park"),
    ("Illegal dumping", "Mattresses left on the pavement.", "Foundry Rd, Industrial Zone"),
    ("Irregular garbage collection", "Collection truck skipped our block twice this week.", "Library Ln, University Park"),
]


def seed_if_empty(db: Session) -> bool:
    if db.scalar(select(func.count()).select_from(Bin)):
        return False
    seed_all(db)
    return True


def reseed(db: Session) -> None:
    """Wipe all demo data (settings are preserved) and seed again."""
    for model in (RouteStop, Route, Alert, CollectionLog, Complaint, Worker, Vehicle, Bin):
        db.execute(delete(model))
    db.commit()
    seed_all(db)


def seed_all(db: Session) -> None:
    rng = random.Random(42)
    now = utcnow()

    # Bins ------------------------------------------------------------
    bins: list[Bin] = []
    n = 1
    for area, (dlat, dlng, streets) in AREAS.items():
        for street in streets:
            for _ in range(2):
                fill = rng.choice([8, 15, 22, 35, 48, 55, 63, 72, 78, 84, 88, 93, 96, 100])
                bins.append(
                    Bin(
                        id=f"BIN-{n:03d}",
                        location=f"{rng.randint(1, 120)} {street}",
                        area=area,
                        category=rng.choice(WASTE_CATEGORIES),
                        fill_level=fill,
                        latitude=round(cfg.city_lat + dlat + rng.uniform(-0.008, 0.008), 6),
                        longitude=round(cfg.city_lng + dlng + rng.uniform(-0.008, 0.008), 6),
                        capacity_kg=rng.choice([80.0, 120.0, 240.0]),
                        last_updated=now - timedelta(minutes=rng.randint(1, 180)),
                    )
                )
                n += 1
    db.add_all(bins)
    db.flush()
    for b in bins:
        alert = sync_alerts_for_bin(db, b)
        if alert:
            alert.created_at = b.last_updated
            alert.is_read = rng.random() < 0.4

    # Vehicles --------------------------------------------------------
    statuses = ["available", "available", "available", "active", "maintenance"]
    for (vid, name, driver), st in zip(VEHICLES, statuses):
        db.add(
            Vehicle(
                id=vid,
                name=name,
                driver=driver,
                status=st,
                latitude=round(cfg.city_lat + rng.uniform(-0.01, 0.01), 6),
                longitude=round(cfg.city_lng + rng.uniform(-0.01, 0.01), 6),
                capacity_kg=2000.0,
            )
        )

    # Workers & complaints ---------------------------------------------
    workers = [Worker(name=n_, department=d) for n_, d in WORKERS]
    db.add_all(workers)
    db.flush()

    for i, (cat, desc, loc) in enumerate(SAMPLE_COMPLAINTS):
        created = now - timedelta(days=rng.randint(0, 20), hours=rng.randint(0, 12))
        status = ["submitted", "under_review", "assigned", "resolved"][i % 4]
        c = Complaint(
            code="TMP",
            name=rng.choice(["Asha Menon", "Rahul Verma", "Sara Thomas", "Kiran Reddy", "Priya Das"]),
            contact=f"citizen{i + 1}@example.com",
            category=cat,
            description=desc,
            location=loc,
            latitude=round(cfg.city_lat + rng.uniform(-0.03, 0.03), 6),
            longitude=round(cfg.city_lng + rng.uniform(-0.03, 0.03), 6),
            status=status,
            created_at=created,
            updated_at=created,
        )
        if status in ("assigned", "resolved"):
            c.assigned_worker_id = rng.choice(workers).id
        if status == "resolved":
            c.resolved_at = created + timedelta(hours=rng.randint(6, 72))
        db.add(c)
        db.flush()
        c.code = f"CMP-{created.year}-{c.id:05d}"

    # 60 days of collection history -----------------------------------
    vehicle_ids = [v[0] for v in VEHICLES]
    for day in range(60, 0, -1):
        for _ in range(rng.randint(8, 18)):
            b = rng.choice(bins)
            db.add(
                CollectionLog(
                    bin_id=b.id,
                    area=b.area,
                    vehicle_id=rng.choice(vehicle_ids),
                    kg=round(b.capacity_kg * rng.uniform(0.6, 1.0), 1),
                    distance_km=round(rng.uniform(0.6, 2.4), 2),
                    collected_at=now - timedelta(days=day, hours=rng.randint(0, 10)),
                )
            )
    # A few collections already today so "Waste Collected Today" isn't zero
    for _ in range(6):
        b = rng.choice(bins)
        db.add(
            CollectionLog(
                bin_id=b.id,
                area=b.area,
                vehicle_id=rng.choice(vehicle_ids),
                kg=round(b.capacity_kg * rng.uniform(0.6, 1.0), 1),
                distance_km=round(rng.uniform(0.6, 2.4), 2),
                collected_at=now - timedelta(minutes=rng.randint(5, 200)),
            )
        )
    db.commit()
