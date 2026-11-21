"""Pure status/severity rules (no DB or framework imports, so they are easy to test)."""

from app.constants import DEFAULT_THRESHOLDS, SEVERITY_RANK


def clamp_fill(value: int) -> int:
    return max(0, min(100, int(value)))


def bin_status(fill: int) -> str:
    """0-49 normal, 50-79 moderate, 80-99 almost_full, 100 full."""
    if fill >= 100:
        return "full"
    if fill >= 80:
        return "almost_full"
    if fill >= 50:
        return "moderate"
    return "normal"


def status_range(status: str) -> tuple[int, int]:
    """Inclusive fill range for a bin status (used for SQL filtering)."""
    return {
        "normal": (0, 49),
        "moderate": (50, 79),
        "almost_full": (80, 99),
        "full": (100, 100),
    }[status]


def alert_severity(fill: int, thresholds: dict | None = None) -> str | None:
    """warning >= thresholds.warning, high >= thresholds.high, critical >= thresholds.critical."""
    th = thresholds or DEFAULT_THRESHOLDS
    if fill >= th["critical"]:
        return "critical"
    if fill >= th["high"]:
        return "high"
    if fill >= th["warning"]:
        return "warning"
    return None


def severity_rank(severity: str | None) -> int:
    return SEVERITY_RANK.get(severity or "", 0)
