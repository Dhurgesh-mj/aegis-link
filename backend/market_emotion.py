# backend/market_emotion.py
"""
Aegis-Link — Market Emotion Index
Aggregates all coin signals into one market-wide emotion index.
Similar to Crypto Fear & Greed Index but computed from our own signal data.
"""

import json
import logging
import statistics
from datetime import datetime, timezone

import redis

import db
from config import REDIS_HOST, REDIS_PORT

log = logging.getLogger("market_emotion")

EMOTION_LABELS = {
    (80, 100): ("EXTREME GREED", "pump"),
    (60, 80):  ("GREED",         "pump"),
    (45, 60):  ("NEUTRAL",       "watch"),
    (25, 45):  ("FEAR",          "dump"),
    (0,  25):  ("EXTREME FEAR",  "dump"),
}


def compute_market_emotion(all_signals: list[dict]) -> dict:
    """Compute market-wide emotion index from all current coin signals."""
    try:
        if not all_signals:
            return {
                "index": 50,
                "label": "NEUTRAL",
                "color": "watch",
                "pump_count": 0,
                "dump_count": 0,
                "watch_count": 0,
                "dominant_coin": None,
                "avg_bot_risk": 0,
                "avg_fomo": 0,
                "total_coins": 0,
                "ts": datetime.now(timezone.utc).isoformat(),
            }

        scores = [s.get("score", 50) for s in all_signals]
        pump_count = len([s for s in all_signals if s.get("signal") == "PUMP"])
        dump_count = len([s for s in all_signals if s.get("signal") == "DUMP"])
        watch_count = len(all_signals) - pump_count - dump_count

        bullish_confidences = [
            s.get("confidence", 50) for s in all_signals
            if s.get("sentiment") == "BULLISH"
        ] or [50]

        pump_ratio = pump_count / max(len(all_signals), 1)
        avg_score = statistics.mean(scores)
        avg_bullish = statistics.mean(bullish_confidences)

        index = round(
            (avg_score      * 0.40) +
            (avg_bullish    * 0.35) +
            (pump_ratio * 100 * 0.25),
            1,
        )
        index = min(max(index, 0), 100)

        label, color = "NEUTRAL", "watch"
        for (lo, hi), (lbl, col) in EMOTION_LABELS.items():
            if lo <= index <= hi:
                label, color = lbl, col
                break

        dominant_coin = max(
            all_signals, key=lambda s: s.get("score", 0)
        ).get("coin") if all_signals else None

        avg_bot_risk = round(
            statistics.mean([s.get("bot_risk", 0) for s in all_signals]), 3
        )

        fomo_scores = [
            s.get("fomo", {}).get("fomo_score", 50)
            for s in all_signals
        ]
        avg_fomo = round(statistics.mean(fomo_scores), 1)

        result = {
            "index": index,
            "label": label,
            "color": color,
            "pump_count": pump_count,
            "dump_count": dump_count,
            "watch_count": watch_count,
            "dominant_coin": dominant_coin,
            "avg_bot_risk": avg_bot_risk,
            "avg_fomo": avg_fomo,
            "total_coins": len(all_signals),
            "ts": datetime.now(timezone.utc).isoformat(),
        }

        # Cache in Redis
        try:
            r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
            r.setex("aegis:market_emotion", 120, json.dumps(result))
        except Exception as exc:
            log.debug("Redis market_emotion cache error: %s", exc)

        # Persist to SQLite emotion_history
        try:
            conn = db._get_conn()
            conn.execute(
                """INSERT INTO emotion_history
                    (index_val, label, pump_count, dump_count, avg_bot_risk, ts)
                VALUES (?, ?, ?, ?, ?, ?)""",
                (index, label, pump_count, dump_count, avg_bot_risk,
                 datetime.now(timezone.utc).isoformat()),
            )
            conn.commit()
        except Exception as exc:
            log.debug("SQLite emotion_history persist error: %s", exc)

        return result

    except Exception as exc:
        log.error("compute_market_emotion error: %s", exc)
        return {
            "index": 50, "label": "NEUTRAL", "color": "watch",
            "pump_count": 0, "dump_count": 0, "watch_count": 0,
            "dominant_coin": None, "avg_bot_risk": 0, "avg_fomo": 0,
            "total_coins": 0,
            "ts": datetime.now(timezone.utc).isoformat(),
        }


def get_emotion_history(n: int = 48) -> list[dict]:
    """Get last n emotion history snapshots, oldest first for chart rendering."""
    try:
        conn = db._get_conn()
        rows = conn.execute(
            "SELECT index_val, label, pump_count, dump_count, avg_bot_risk, ts "
            "FROM emotion_history ORDER BY ts DESC LIMIT ?",
            (n,),
        ).fetchall()
        result = [dict(r) for r in rows]
        result.reverse()  # oldest first for charts
        return result
    except Exception as exc:
        log.error("get_emotion_history error: %s", exc)
        return []
