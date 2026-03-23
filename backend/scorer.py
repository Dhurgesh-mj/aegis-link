# backend/scorer.py
"""
Aegis-Link — Hype Score Calculator
Weighted formula: velocity, sentiment, influence, volume.
Bot risk applied as penalty multiplier.
All inputs normalized 0-100 before calling compute_score.
"""

import math
import logging

from config import BOT_PENALTY

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [scorer] %(levelname)s  %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger("scorer")


def normalize_velocity(current_count: int, prior_count: int) -> float:
    """Normalize mention velocity as percentage growth, capped 0-100."""
    if prior_count == 0:
        return 50.0
    growth = (current_count - prior_count) / max(prior_count, 1) * 100
    return min(max(growth, 0), 100)


def normalize_volume(price_change_24h: float) -> float:
    """Normalize 24h price change to 0-100 scale."""
    return min(max(abs(price_change_24h) * 2, 0), 100)


def normalize_influence(max_followers: int) -> float:
    """Log-scale normalization of follower count, 0-100."""
    return math.log10(max_followers + 1) / math.log10(1_000_001) * 100


def compute_score(
    velocity: float,
    sentiment: float,
    volume: float,
    influence: float,
    bot_risk: float,
    onchain_score: float = 50.0,
) -> float:
    """
    Compute final hype score.

    Formula (v2 — 6-factor):
      raw = (velocity * 0.25 + sentiment * 0.20
           + influence * 0.20 + volume * 0.15
           + anomaly_proxy * 0.10 + onchain * 0.10)
      score = raw * (1 - bot_risk * BOT_PENALTY)

    All inputs should be normalized 0-100 before calling.
    bot_risk is 0.0-1.0.
    onchain_score is 0-100 (default 50 = neutral).
    Returns rounded float 0-100.
    """
    raw = (
        velocity      * 0.25
        + sentiment   * 0.20
        + influence   * 0.20
        + volume      * 0.15
        + influence   * 0.10   # anomaly proxy — reuses influence until anomaly fully integrated
        + onchain_score * 0.10
    )

    # Apply bot penalty
    score = raw * (1 - bot_risk * BOT_PENALTY)

    # Clamp to 0-100
    score = max(0.0, min(100.0, score))

    return round(score, 2)
