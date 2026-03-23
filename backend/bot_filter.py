# backend/bot_filter.py
"""
Aegis-Link — Bot & Sybil Detection Engine
Analyzes batches of events per coin to detect coordinated manipulation,
rug-pull language, velocity anomalies, and sybil networks.
"""

import logging
import time
from collections import defaultdict, deque

log = logging.getLogger("bot_filter")

# ── Rolling window state (per coin) ─────────────────────
# Each deque stores (timestamp, event_dict) tuples
_rolling_events: dict[str, deque] = defaultdict(lambda: deque(maxlen=500))
_rolling_mention_counts: dict[str, deque] = defaultdict(lambda: deque(maxlen=100))

# ── Rug-pull language keywords ──────────────────────────
_RUG_KEYWORDS = {
    "rug", "rugged", "rug pull", "rugpull",
    "honeypot", "honey pot",
    "scam", "scammed",
    "exit liquidity", "exit scam",
    "dev dumped", "dev dump", "dev sold",
    "pump and dump", "ponzi",
    "contract renounced", "migrating",
    "stealth launch",
}

_WINDOW_SECONDS = 600  # 10 minutes


def _now() -> float:
    return time.time()


def _clean_window(window: deque, cutoff: float):
    """Remove entries older than cutoff from the left of the deque."""
    while window and window[0][0] < cutoff:
        window.popleft()


async def analyze_bot_risk(events: list[dict], coin: str = "UNKNOWN") -> dict:
    """
    Analyze a batch of events for a single coin window.

    Returns:
        {
            "bot_risk": float 0.0 - 1.0,
            "flags": list[str]
        }
    """
    if not events:
        return {"bot_risk": 0.0, "flags": []}

    bot_risk = 0.0
    flags: list[str] = []
    now = _now()
    cutoff = now - _WINDOW_SECONDS

    # Update rolling state
    for evt in events:
        _rolling_events[coin].append((now, evt))

    _clean_window(_rolling_events[coin], cutoff)

    # Get all events in the current 10-minute window
    window_events = [e for ts, e in _rolling_events[coin] if ts >= cutoff]

    # ── Rule 1: Coordinated Spam ────────────────────────
    # >5 events with same text in 10 minutes
    text_counts: dict[str, int] = defaultdict(int)
    for evt in window_events:
        text = evt.get("text", "").strip().lower()[:100]
        if text:
            text_counts[text] += 1

    max_same_text = max(text_counts.values()) if text_counts else 0
    if max_same_text > 5:
        bot_risk += 0.4
        flags.append("coordinated_spam")
        log.info("[%s] coordinated_spam detected: %d identical messages", coin, max_same_text)

    # ── Rule 2: Low Follower Burst ──────────────────────
    # followers < 10 AND > 3 posts same coin in 5 minutes
    five_min_cutoff = now - 300
    low_follower_recent = [
        evt for ts, evt in _rolling_events[coin]
        if ts >= five_min_cutoff and evt.get("followers", 0) < 10
    ]
    low_follower_authors: dict[str, int] = defaultdict(int)
    for evt in low_follower_recent:
        author = evt.get("author", "unknown")
        low_follower_authors[author] += 1

    for author, count in low_follower_authors.items():
        if count > 3:
            bot_risk += 0.3
            flags.append("low_follower_burst")
            log.info("[%s] low_follower_burst: %s posted %d times in 5min", coin, author, count)
            break  # Only apply once

    # ── Rule 3: Rug-Pull Language ───────────────────────
    for evt in events:
        text_lower = evt.get("text", "").lower()
        for keyword in _RUG_KEYWORDS:
            if keyword in text_lower:
                bot_risk += 0.2
                flags.append("rug_pull_language")
                log.info("[%s] rug_pull_language detected: '%s'", coin, keyword)
                break
        if "rug_pull_language" in flags:
            break

    # ── Rule 4: Velocity Anomaly ────────────────────────
    # mentions > 3x rolling 10-minute average
    mention_count_now = len(window_events)
    _rolling_mention_counts[coin].append((now, mention_count_now))
    _clean_window(_rolling_mention_counts[coin], now - 3600)

    historical_counts = [c for ts, c in _rolling_mention_counts[coin] if ts < cutoff]
    if historical_counts:
        avg_mentions = sum(historical_counts) / len(historical_counts)
        if avg_mentions > 0 and mention_count_now > 3 * avg_mentions:
            bot_risk += 0.2
            flags.append("velocity_anomaly")
            log.info(
                "[%s] velocity_anomaly: %d mentions vs avg %.1f",
                coin, mention_count_now, avg_mentions,
            )

    # ── Rule 5: Sybil Network ──────────────────────────
    # >50% posters have followers < 50
    if window_events:
        low_follower_count = sum(
            1 for evt in window_events if evt.get("followers", 0) < 50
        )
        pct_low = low_follower_count / len(window_events)
        if pct_low > 0.5 and len(window_events) >= 5:
            bot_risk += 0.3
            flags.append("sybil_network")
            log.info(
                "[%s] sybil_network: %.0f%% low-follower accounts (%d/%d)",
                coin, pct_low * 100, low_follower_count, len(window_events),
            )

    # Cap at 1.0
    bot_risk = min(bot_risk, 1.0)
    bot_risk = round(bot_risk, 2)

    return {"bot_risk": bot_risk, "flags": flags}
