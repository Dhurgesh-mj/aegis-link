# backend/correlation_engine.py
"""
Aegis-Link — Coin Correlation Engine
Detects score correlations between tracked coins using Pearson correlation
on score history from SQLite chart_points table.
Identifies which coins move together.
"""

import json
import logging
import statistics
from datetime import datetime, timezone

import redis

import db
from config import REDIS_HOST, REDIS_PORT, TRACKED_COINS

log = logging.getLogger("correlation_engine")


def compute_correlation(scores_a: list[float], scores_b: list[float]) -> float:
    """Compute Pearson correlation coefficient between two score series."""
    n = min(len(scores_a), len(scores_b))
    if n < 5:
        return 0.0

    a = scores_a[:n]
    b = scores_b[:n]

    try:
        # Python 3.12+ has statistics.correlation
        return round(statistics.correlation(a, b), 3)
    except AttributeError:
        pass

    # Manual Pearson for older Python
    try:
        mean_a = statistics.mean(a)
        mean_b = statistics.mean(b)
        num = sum((ai - mean_a) * (bi - mean_b) for ai, bi in zip(a, b))
        den_a = sum((ai - mean_a) ** 2 for ai in a) ** 0.5
        den_b = sum((bi - mean_b) ** 2 for bi in b) ** 0.5
        if den_a == 0 or den_b == 0:
            return 0.0
        return round(num / (den_a * den_b), 3)
    except Exception:
        return 0.0


def find_strong_pairs(matrix: dict, coins: list[str]) -> list[dict]:
    """Find pairs with abs(correlation) > 0.70, deduplicated, sorted by strength."""
    pairs = []
    seen = set()

    for coin_a in coins:
        for coin_b in coins:
            if coin_a == coin_b:
                continue
            pair_key = tuple(sorted([coin_a, coin_b]))
            if pair_key in seen:
                continue
            seen.add(pair_key)

            corr = matrix.get(coin_a, {}).get(coin_b, 0)
            abs_corr = abs(corr)

            if abs_corr > 0.70:
                if abs_corr > 0.85:
                    strength = "STRONG"
                elif abs_corr > 0.70:
                    strength = "MODERATE"
                else:
                    strength = "WEAK"

                pairs.append({
                    "coin_a": coin_a,
                    "coin_b": coin_b,
                    "correlation": corr,
                    "type": "positive" if corr > 0 else "negative",
                    "strength": strength,
                })

    pairs.sort(key=lambda p: abs(p["correlation"]), reverse=True)
    return pairs


def build_correlation_matrix(coin_scores: dict[str, list[float]]) -> dict:
    """Build NxN correlation matrix from coin score histories."""
    coins = [c for c, scores in coin_scores.items() if len(scores) >= 5]

    matrix: dict[str, dict[str, float]] = {}
    for coin_a in coins:
        matrix[coin_a] = {}
        for coin_b in coins:
            if coin_a == coin_b:
                matrix[coin_a][coin_b] = 1.0
            else:
                matrix[coin_a][coin_b] = compute_correlation(
                    coin_scores[coin_a], coin_scores[coin_b]
                )

    pairs = find_strong_pairs(matrix, coins)

    return {
        "matrix": matrix,
        "coins": coins,
        "strong_pairs": pairs,
        "ts": datetime.now(timezone.utc).isoformat(),
    }


def get_coin_score_history(coin: str, n: int = 20) -> list[float]:
    """Get last n scores from chart_points table, oldest first."""
    try:
        conn = db._get_conn()
        rows = conn.execute(
            "SELECT score FROM chart_points WHERE coin = ? ORDER BY ts DESC LIMIT ?",
            (coin.upper(), n),
        ).fetchall()
        scores = [float(r["score"]) for r in rows]
        scores.reverse()  # oldest first
        return scores
    except Exception as exc:
        log.debug("get_coin_score_history error for %s: %s", coin, exc)
        return []


async def compute_full_matrix() -> dict:
    """Compute full correlation matrix for all tracked coins, with Redis caching."""
    try:
        # Check Redis cache
        r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
        cached = r.get("aegis:correlation")
        if cached:
            try:
                return json.loads(cached)
            except json.JSONDecodeError:
                pass

        # Build from scratch
        coin_scores: dict[str, list[float]] = {}
        for coin in TRACKED_COINS:
            scores = get_coin_score_history(coin, 20)
            if scores:
                coin_scores[coin] = scores

        result = build_correlation_matrix(coin_scores)

        # Cache with 300s TTL
        try:
            r.setex("aegis:correlation", 300, json.dumps(result))
        except Exception as exc:
            log.debug("Redis correlation cache error: %s", exc)

        return result

    except Exception as exc:
        log.error("compute_full_matrix error: %s", exc)
        return {
            "matrix": {},
            "coins": [],
            "strong_pairs": [],
            "ts": datetime.now(timezone.utc).isoformat(),
        }
