"""Shared enums/vocabularies. Values mirror the frontend spec."""

WASTE_CATEGORIES = ["General", "Recyclable", "Organic", "Hazardous"]

BIN_STATUSES = ["normal", "moderate", "almost_full", "full"]

ALERT_SEVERITIES = ["warning", "high", "critical"]
SEVERITY_RANK = {"warning": 1, "high": 2, "critical": 3}

COMPLAINT_CATEGORIES = [
    "Overflowing garbage bin",
    "Irregular garbage collection",
    "Illegal dumping",
    "Damaged garbage bin",
    "Other",
]
COMPLAINT_STATUSES = ["submitted", "under_review", "assigned", "resolved"]

VEHICLE_STATUSES = ["available", "active", "maintenance"]
ROUTE_STATUSES = ["planned", "in_progress", "completed"]

ROUTE_COLORS = ["#0d9488", "#2563eb", "#9333ea", "#ea580c", "#db2777", "#65a30d"]

DEFAULT_THRESHOLDS = {"warning": 80, "high": 90, "critical": 100}

DEFAULT_APP_SETTINGS = {
    "profile": {
        "name": "Admin User",
        "email": "admin@greenvale.example",
        "phone": "",
        "role": "Municipal Administrator",
    },
    "notifications": {
        "inApp": True,
        "emailSimulated": True,
        "smsSimulated": False,
        "criticalOnly": False,
    },
    "thresholds": dict(DEFAULT_THRESHOLDS),
    "system": {
        "theme": "light",
        "language": "en",
        "autoRefreshSeconds": 30,
        "simulationAutoTick": False,
    },
}
