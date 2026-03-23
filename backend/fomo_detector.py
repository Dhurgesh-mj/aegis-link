# backend/fomo_detector.py
"""
Aegis-Link — FOMO Detector
Detects emotional buying pressure per coin.
Derived from velocity acceleration, sentiment confidence, and mention growth rate.
Pure signal math — no ML.
"""

import json
import logging

import redis

from config import REDIS_HOST, REDIS_PORT

log = logging.getLogger("fomo_detector")

FOMO_LEVELS = {
    (80, 100): "EXTREME",
    (60, 80):  "HIGH",
    (40, 60):  "MEDIUM",
    (20, 40):  "LOW",
    (0,  20):  "NONE",
}


def compute_fomo_score(
    velocity_pct: float,
    sentiment_confidence: float,
    mention_acceleration: float,
    bot_risk: float,
) -> dict:
    """
    Compute FOMO score from signal inputs.
    mention_acceleration = rate of change of velocity (current - previous).
    All inputs 0-100 except bot_risk (0.0-1.0).
    """
    try:
        vel_clamped = min(max(velocity_pct, 0), 100)
        accel_clamped = min(max(mention_acceleration, 0), 100)
        conf_clamped = min(max(sentiment_confidence, 0), 100)

        raw = (
            vel_clamped    * 0.40 +
            conf_clamped   * 0.35 +
            accel_clamped  * 0.25
        )

        adjusted = raw * (1 - bot_risk * 0.30)
        score = round(min(max(adjusted, 0), 100), 2)

        level = "NONE"
        for (lo, hi), label in FOMO_LEVELS.items():
            if lo <= score <= hi:
                level = label
                break

        result = {
            "fomo_score": score,
            "fomo_level": level,
            "is_fomo_driven": score > 60,
            "raw_velocity": round(velocity_pct, 1),
            "acceleration": round(mention_acceleration, 1),
            "bot_adjusted": True,
        }

        return result

    except Exception as exc:
        log.error("FOMO computation error: %s", exc)
        return {
            "fomo_score": 0,
            "fomo_level": "NONE",
            "is_fomo_driven": False,
            "raw_velocity": 0,
            "acceleration": 0,
            "bot_adjusted": False,
        }


def store_fomo(coin: str, result: dict) -> None:
    """Cache FOMO result in Redis with 300s TTL."""
    try:
        r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
        payload = {**result, "coin": coin}
        r.setex(f"aegis:fomo:{coin}", 300, json.dumps(payload))
    except Exception as exc:
        log.debug("FOMO Redis cache error for %s: %s", coin, exc)


async def get_all_fomo() -> list[dict]:
    """Scan Redis for all fomo entries, return sorted by fomo_score descending."""
    try:
        r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
        keys = r.keys("aegis:fomo:*")
        results = []
        for key in keys:
            raw = r.get(key)
            if raw:
                try:
                    data = json.loads(raw)
                    # Ensure coin field is present
                    if "coin" not in data:
                        data["coin"] = key.split(":")[-1]
                    results.append(data)
                except json.JSONDecodeError:
                    pass
        results.sort(key=lambda d: d.get("fomo_score", 0), reverse=True)
        return results
    except Exception as exc:
        log.error("get_all_fomo error: %s", exc)
        return []
