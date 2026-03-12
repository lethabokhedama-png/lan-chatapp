"""Timestamp helpers — always UTC ISO-8601."""
from datetime import datetime, timezone


def now() -> str:
    return datetime.now(timezone.utc).isoformat()


def now_ms() -> int:
    return int(datetime.now(timezone.utc).timestamp() * 1000)


def month_key() -> str:
    """e.g. '2026-03'  — used as shard filename."""
    return datetime.now(timezone.utc).strftime("%Y-%m")


def date_key() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")