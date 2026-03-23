# backend/lag_detector.py
"""
Aegis-Link — Hype Propagation Lag Detector
Detects which platform mentions a coin first.
Finds the origin source and shows lag (seconds) between platforms.
"""

import logging
from datetime import datetime

log = logging.getLogger("lag_detector")

SOURCE_ORDER_LABELS = {
    "4chan":       "4chan /biz/",
    "telegram":   "Telegram",
    "reddit":     "Reddit",
    "stocktwits": "StockTwits",
    "cryptopanic": "CryptoPanic",
    "coingecko":  "CoinGecko",
}


def detect_lag(events: list[dict], coin: str) -> dict:
    """Detect hype propagation lag across sources for a given coin."""
    try:
        if len(events) < 2:
            single_src = None
            if events:
                single_src = events[0].get("source", "unknown").split("/")[0]
            return {
                "origin": single_src,
                "origin_label": SOURCE_ORDER_LABELS.get(single_src or "", single_src or "unknown"),
                "lag_map": {},
                "propagation_path": [single_src] if single_src else [],
                "total_spread_seconds": 0,
                "insight": "",
            }

        # Sort events by timestamp ascending
        def parse_ts(evt: dict) -> datetime:
            ts = evt.get("ts", "")
            try:
                return datetime.fromisoformat(str(ts).replace("Z", "+00:00"))
            except (ValueError, TypeError):
                return datetime.min

        sorted_events = sorted(events, key=parse_ts)

        # Find first occurrence of each source
        source_first_seen: dict[str, dict] = {}
        for evt in sorted_events:
            src = evt.get("source", "unknown").split("/")[0]
            if src not in source_first_seen:
                dt = parse_ts(evt)
                source_first_seen[src] = {
                    "ts": evt.get("ts", ""),
                    "dt": dt,
                    "source": src,
                    "label": SOURCE_ORDER_LABELS.get(src, src),
                    "first_text": (evt.get("text", "") or "")[:80],
                }

        if len(source_first_seen) < 2:
            only_src = list(source_first_seen.keys())[0] if source_first_seen else "unknown"
            return {
                "origin": only_src,
                "origin_label": SOURCE_ORDER_LABELS.get(only_src, only_src),
                "lag_map": {},
                "propagation_path": [only_src],
                "total_spread_seconds": 0,
                "insight": f"All mentions from {SOURCE_ORDER_LABELS.get(only_src, only_src)}",
            }

        # Determine origin (earliest source)
        origin_src = min(
            source_first_seen.keys(),
            key=lambda s: source_first_seen[s]["dt"],
        )
        origin_dt = source_first_seen[origin_src]["dt"]

        # Compute lag for each source relative to origin
        lag_map: dict[str, dict] = {}
        for src, info in source_first_seen.items():
            delta = (info["dt"] - origin_dt).total_seconds()
            lag_map[src] = {
                "seconds": int(delta),
                "label": info["label"],
                "ts": info["ts"],
            }

        # Propagation path sorted by time
        propagation_path = sorted(
            source_first_seen.keys(),
            key=lambda s: lag_map[s]["seconds"],
        )

        max_lag = max(v["seconds"] for v in lag_map.values())

        insight = _build_lag_insight(origin_src, lag_map)

        return {
            "origin": origin_src,
            "origin_label": SOURCE_ORDER_LABELS.get(origin_src, origin_src),
            "lag_map": lag_map,
            "propagation_path": propagation_path,
            "total_spread_seconds": max_lag,
            "insight": insight,
        }

    except Exception as exc:
        log.error("detect_lag error for %s: %s", coin, exc)
        return {
            "origin": None,
            "origin_label": "",
            "lag_map": {},
            "propagation_path": [],
            "total_spread_seconds": 0,
            "insight": "",
        }


def _build_lag_insight(origin: str, lag_map: dict) -> str:
    """Build human-readable insight about propagation."""
    try:
        if origin == "4chan":
            reddit_lag = lag_map.get("reddit", {}).get("seconds", 0)
            if reddit_lag > 0:
                return (
                    f"Originated on 4chan /biz/ — "
                    f"reached Reddit {reddit_lag // 60}min later. "
                    f"Early signal window: {reddit_lag // 60} minutes."
                )
            return "Originated on 4chan /biz/"

        if origin == "telegram":
            reddit_lag = lag_map.get("reddit", {}).get("seconds", 0)
            return (
                f"KOL-driven: started in Telegram, "
                f"spread to Reddit after {reddit_lag // 60}min."
            )

        return f"Hype originated on {SOURCE_ORDER_LABELS.get(origin, origin)}"

    except Exception:
        return f"Hype originated on {SOURCE_ORDER_LABELS.get(origin, origin)}"
