# backend/anomaly_detector.py
"""
Aegis-Link — Statistical Anomaly Detector
Detects anomalies in mention velocity using z-score against a rolling 7-day baseline per coin.
Stores baseline data in SQLite via db.py
"""

import logging
import statistics
from datetime import datetime, timezone

import db

log = logging.getLogger("anomaly_detector")


class AnomalyDetector:

    def update_baseline(self, coin: str, mention_count: int, ts: str) -> None:
        """Insert a new baseline data point and prune to last 1008 rows per coin (7 days)."""
        conn = db._get_conn()
        conn.execute(
            "INSERT INTO baselines (coin, mention_count, ts) VALUES (?, ?, ?)",
            (coin.upper(), mention_count, ts),
        )
        # Keep only last 1008 rows per coin (7 days * 144 intervals/day at 10min)
        conn.execute(
            """DELETE FROM baselines WHERE coin = ? AND id NOT IN (
                SELECT id FROM baselines WHERE coin = ? ORDER BY ts DESC LIMIT 1008
            )""",
            (coin.upper(), coin.upper()),
        )
        conn.commit()

    def get_stats(self, coin: str) -> dict:
        """Compute mean and std of mention_count over the rolling baseline."""
        conn = db._get_conn()
        rows = conn.execute(
            "SELECT mention_count FROM baselines WHERE coin = ? ORDER BY ts DESC LIMIT 1008",
            (coin.upper(),),
        ).fetchall()

        if len(rows) < 24:
            return {"mean": 0, "std": 1, "n": 0}

        values = [r["mention_count"] for r in rows]
        mean_val = statistics.mean(values)
        std_val = statistics.stdev(values) if len(values) > 1 else 0

        return {
            "mean": mean_val,
            "std": std_val,
            "n": len(values),
        }

    def compute_zscore(self, coin: str, current_count: int) -> float:
        """Compute z-score relative to rolling baseline."""
        stats = self.get_stats(coin)
        if stats["n"] < 24:
            return 0.0
        z = (current_count - stats["mean"]) / max(stats["std"], 1)
        return round(z, 3)

    def is_anomaly(self, coin: str, current_count: int) -> dict:
        """Determine if the current mention count is anomalous."""
        stats = self.get_stats(coin)
        if stats["n"] < 24:
            z = 0.0
        else:
            z = (current_count - stats["mean"]) / max(stats["std"], 1)
            z = round(z, 3)

        severity = (
            "extreme" if abs(z) > 4.0 else
            "high"    if abs(z) > 3.0 else
            "medium"  if abs(z) > 2.0 else
            "normal"
        )

        return {
            "z_score": z,
            "is_anomaly": abs(z) > 2.5,
            "direction": "spike" if z > 0 else "drop",
            "severity": severity,
            "baseline_mean": round(stats["mean"], 2),
            "baseline_std": round(stats["std"], 2),
            "sample_size": stats["n"],
        }

    def get_zscore_history(self, coin: str, n: int = 60) -> list[dict]:
        """Get recent z-score history for charting."""
        conn = db._get_conn()
        rows = conn.execute(
            "SELECT mention_count, ts FROM baselines WHERE coin = ? ORDER BY ts DESC LIMIT ?",
            (coin.upper(), n),
        ).fetchall()

        if not rows:
            return []

        stats = self.get_stats(coin)
        result = []
        for row in rows:
            count = row["mention_count"]
            if stats["n"] >= 24:
                zscore = round((count - stats["mean"]) / max(stats["std"], 1), 3)
            else:
                zscore = 0.0
            result.append({
                "ts": row["ts"],
                "count": count,
                "zscore": zscore,
            })

        result.reverse()  # oldest first
        return result
