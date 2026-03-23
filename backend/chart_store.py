# backend/chart_store.py
"""
Aegis-Link — Chart Store (SQLite)

Stores per-coin time-series snapshots of scored signals so the frontend can
render score trend graphs.
"""

from __future__ import annotations

import logging

import db

log = logging.getLogger("chart_store")

MAX_POINTS = db.MAX_CHART_POINTS


def push_snapshot(coin: str, signal: dict) -> None:
    """Store a single chart snapshot for a coin."""
    try:
        db.push_chart_snapshot(coin, signal)
    except Exception as exc:
        log.error("Failed to push chart snapshot for %s: %s", coin, exc)


def get_chart(coin: str, limit: int = 100) -> list[dict]:
    """Return newest `limit` points for one coin, in chronological order."""
    try:
        return db.get_chart(coin, limit)
    except Exception as exc:
        log.error("Failed to get chart for %s: %s", coin, exc)
        return []


def get_all_charts(limit: int = 50) -> dict[str, list[dict]]:
    """Return {COIN: points[]} for all coins that have chart data."""
    try:
        return db.get_all_charts(limit)
    except Exception as exc:
        log.error("Failed to get all charts: %s", exc)
        return {}
