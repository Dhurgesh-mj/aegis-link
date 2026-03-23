# backend/predictor.py
"""
Aegis-Link — Main Prediction Engine Loop
On each POLL_INTERVAL: drain events, sentiment, bot detection, score,
signal generation, Redis pub/sub broadcast, SQLite persistence.
v2: + anomaly detection, campaign detection, on-chain scoring, pattern matching
"""

import asyncio
import json
import logging
import time
import uuid
from collections import defaultdict, deque
from datetime import datetime, timezone

import redis

from config import (
    REDIS_HOST, REDIS_PORT, REDIS_SIGNAL_CHANNEL,
    TRACKED_COINS, PUMP_THRESHOLD, DUMP_THRESHOLD,
    POLL_INTERVAL,
    MIN_COIN_EVENTS_FOR_SIGNAL,
    EVENT_WINDOW_SEC,
    COINGECKO_IDS,
)
from collector import event_queue, run_collectors
from sentiment import score_sentiment
from bot_filter import analyze_bot_risk
from scorer import compute_score, normalize_velocity, normalize_volume, normalize_influence
from notification_router import route_to_users
from chart_store import push_snapshot
from anomaly_detector import AnomalyDetector
from campaign_detector import CampaignDetector
from onchain_fetcher import compute_onchain_score
from pattern_matcher import PatternMatcher
import db

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s  %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger("predictor")

# Redis connection — used ONLY for pub/sub broadcast
redis_client = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)

# ── v2 module instances ─────────────────────────────────
anomaly_detector = AnomalyDetector()
campaign_detector = CampaignDetector()
pattern_matcher = PatternMatcher()

# ── Rolling event windows per coin ──────────────────────
_coin_events: dict[str, deque] = defaultdict(lambda: deque(maxlen=1000))
_prev_window_counts: dict[str, int] = defaultdict(int)
_volume_data: dict[str, float] = defaultdict(float)
_signals_today_count = 0
_start_time = time.time()

# Per-coin notification throttling for WATCH (PUMP/DUMP always sent)
_LAST_USER_NOTIFY: dict[str, float] = {}
_NOTIFY_COOLDOWN_SEC = 300  # 5 minutes between per-user notifications per coin


def _market_bootstrap_events(coin: str) -> list[dict] | None:
    """
    When the queue has no row for this coin, synthesize enough ticks from
    market data (from SQLite) so the predictor can score.
    """
    raw = db.get_market_data(coin)
    if not raw:
        return None
    try:
        pc = float(raw.get("price_change_24h", 0) or 0)
        vol = float(raw.get("volume_24h", 0) or 0)
    except ValueError:
        return None
    slug = COINGECKO_IDS.get(coin, coin.lower())
    text = f"{coin} price {pc:+.2f}% volume {vol:,.0f}"
    base = {
        "source": "coingecko",
        "author": "coingecko_api",
        "followers": int(vol / 1000) if vol else 0,
        "text": text,
        "coins": [coin],
        "url": f"https://www.coingecko.com/en/coins/{slug}",
        "price_change_24h": pc,
        "volume_24h": vol,
    }

    events: list[dict] = []
    for _ in range(MIN_COIN_EVENTS_FOR_SIGNAL):
        events.append(
            {
                "id": uuid.uuid4().hex[:16],
                "ts": datetime.now(timezone.utc).isoformat(),
                **base,
            }
        )

    return events


async def _route_signal_to_users(signal: dict) -> None:
    """Route to users with throttling."""
    st = signal.get("signal", "WATCH")
    coin = signal.get("coin") or ""
    now = time.time()

    # For PUMP/DUMP, always attempt delivery (per-user cooldowns in notification_router)
    if st in ("PUMP", "DUMP"):
        await route_to_users(signal)
        _LAST_USER_NOTIFY[coin] = now
        return

    # WATCH: throttle at engine level too
    last = _LAST_USER_NOTIFY.get(coin, 0)
    if now - last < _NOTIFY_COOLDOWN_SEC:
        return
    _LAST_USER_NOTIFY[coin] = now
    await route_to_users(signal)


def _drain_queue() -> list[dict]:
    """Drain all pending events from the collector queue."""
    events = []
    while not event_queue.empty():
        try:
            events.append(event_queue.get_nowait())
        except asyncio.QueueEmpty:
            break
    return events


def _bucket_events_by_coin(events: list[dict]) -> dict[str, list[dict]]:
    """Group events by coin ticker."""
    bucketed: dict[str, list[dict]] = defaultdict(list)
    for evt in events:
        for coin in evt.get("coins", []):
            coin_upper = coin.upper()
            if coin_upper in TRACKED_COINS:
                bucketed[coin_upper].append(evt)
    return bucketed


async def _analyze_coin(coin: str, events: list[dict]) -> dict | None:
    """Run the full analysis pipeline for a single coin."""
    global _signals_today_count

    now = time.time()
    cutoff = now - EVENT_WINDOW_SEC

    # Add new events to rolling window
    for evt in events:
        _coin_events[coin].append((now, evt))

    # Clean old events
    while _coin_events[coin] and _coin_events[coin][0][0] < cutoff:
        _coin_events[coin].popleft()

    window_events = [e for ts, e in _coin_events[coin] if ts >= cutoff]

    if len(window_events) < MIN_COIN_EVENTS_FOR_SIGNAL:
        return None

    # ── Sentiment analysis (max 5 concurrent) ───────────
    sem = asyncio.Semaphore(5)

    async def _score_one(text: str) -> dict:
        async with sem:
            return await score_sentiment(text)

    # Only analyze unique texts (up to 15)
    unique_texts = list({evt.get("text", "")[:500] for evt in window_events})[:15]
    sentiment_tasks = [_score_one(text) for text in unique_texts]
    sentiments = await asyncio.gather(*sentiment_tasks, return_exceptions=True)

    # Aggregate sentiment
    bullish_count = 0
    bearish_count = 0
    confidence_scores = []

    for s in sentiments:
        if isinstance(s, Exception):
            continue
        label = s.get("label", "NEUTRAL")
        conf = s.get("confidence", 50)
        if label == "BULLISH":
            bullish_count += 1
            confidence_scores.append(conf)
        elif label == "BEARISH":
            bearish_count += 1
            confidence_scores.append(100 - conf)
        else:
            confidence_scores.append(50)

    avg_confidence = sum(confidence_scores) // max(len(confidence_scores), 1)

    if bullish_count > bearish_count:
        overall_sentiment = "BULLISH"
    elif bearish_count > bullish_count:
        overall_sentiment = "BEARISH"
    else:
        overall_sentiment = "NEUTRAL"

    # Sentiment normalized: BULLISH=score, BEARISH=100-score, NEUTRAL=50
    sentiment_norm = avg_confidence

    # ── Bot risk analysis ───────────────────────────────
    bot_result = await analyze_bot_risk(window_events, coin)
    bot_risk = bot_result["bot_risk"]
    bot_flags = bot_result["flags"]

    # ── v2: Parallel advanced analysis ─────────────────
    anomaly_result, campaign_result, onchain_score = await asyncio.gather(
        asyncio.to_thread(anomaly_detector.is_anomaly, coin, len(window_events)),
        asyncio.to_thread(campaign_detector.analyze, window_events, coin),
        compute_onchain_score(coin),
    )

    # ── Score computation (v2: includes onchain) ───────
    current_count = len(window_events)
    prev_count = _prev_window_counts.get(coin, 0)

    velocity = normalize_velocity(current_count, prev_count)
    volume_norm = normalize_volume(_volume_data.get(coin, 0))

    max_followers = max((evt.get("followers", 0) for evt in window_events), default=0)
    influence_norm = normalize_influence(max_followers)

    score = compute_score(velocity, sentiment_norm, volume_norm, influence_norm, bot_risk, onchain_score)

    # Update previous window count
    _prev_window_counts[coin] = current_count

    # ── v2: Update anomaly baseline ────────────────────
    try:
        anomaly_detector.update_baseline(
            coin, len(window_events), datetime.now(timezone.utc).isoformat()
        )
    except Exception as exc:
        log.debug("Anomaly baseline update failed for %s: %s", coin, exc)

    # ── v2: Pattern matching + confidence interval ─────
    similar = pattern_matcher.find_similar(score, anomaly_result["z_score"], bot_risk)
    interval = pattern_matcher.compute_confidence_interval(similar)

    # ── Signal determination ────────────────────────────
    if score > PUMP_THRESHOLD:
        signal_type = "PUMP"
    elif score < DUMP_THRESHOLD:
        signal_type = "DUMP"
    else:
        signal_type = "WATCH"

    # ── Velocity percentage ─────────────────────────────
    velocity_pct = 0
    if prev_count > 0:
        velocity_pct = round(((current_count - prev_count) / prev_count) * 100)
    elif current_count > 0:
        velocity_pct = current_count * 100

    # ── Top source ──────────────────────────────────────
    source_counts: dict[str, int] = defaultdict(int)
    for evt in window_events:
        source_counts[evt.get("source", "unknown")] += 1
    top_source = max(source_counts, key=source_counts.get) if source_counts else "unknown"

    # ── Explanation (v2: richer) ────────────────────────
    parts = []
    if velocity > 50:
        parts.append(f"+{velocity:.0f}% mention spike")
    if max_followers > 10000:
        follower_str = f"{max_followers // 1000}K" if max_followers < 1_000_000 else f"{max_followers / 1_000_000:.1f}M"
        parts.append(f"influencer amplification ({follower_str} followers)")
    if bot_risk > 0.65:
        parts.append(f"WARNING: manipulation detected ({', '.join(bot_flags)})")
    if anomaly_result["is_anomaly"]:
        parts.append(f"{anomaly_result['z_score']:.1f}σ anomaly")
    if campaign_result["campaign_detected"]:
        parts.append(
            f"CAMPAIGN #{campaign_result['campaign_id']} "
            f"({campaign_result['account_count']} accounts)"
        )
    if onchain_score > 70:
        parts.append("on-chain buy pressure confirmed")
    if interval["sample_size"] > 0:
        parts.append(
            f"~{interval['avg_lead_minutes']:.0f}min before price move historically"
        )

    explanation = f"${coin}: " + ", ".join(parts) if parts else f"${coin}: monitoring via {top_source}"

    # ── Build signal dict (v2: enriched) ────────────────
    signal = {
        "coin": coin,
        "score": score,
        "signal": signal_type,
        "confidence": avg_confidence,
        "sentiment": overall_sentiment,
        "velocity_pct": velocity_pct,
        "volume_spike": round(_volume_data.get(coin, 0), 2),
        "bot_risk": bot_risk,
        "bot_flags": bot_flags,
        "top_source": top_source,
        "influencer_weight": influence_norm,
        "explanation": explanation,
        "event_count": len(window_events),
        "ts": datetime.now(timezone.utc).isoformat(),
        "anomaly": anomaly_result,
        "campaign": campaign_result,
        "onchain_score": onchain_score,
        "confidence_interval": interval,
        "similar_patterns": similar[:3],
    }

    # ── Publish to Redis pub/sub (for real-time WS) ────
    try:
        redis_client.publish(REDIS_SIGNAL_CHANNEL, json.dumps(signal))
        log.info(
            "%s | %s | score=%.1f | bot:%.2f",
            coin, signal_type, score, bot_risk,
        )
    except Exception as exc:
        log.error("Redis publish error: %s", exc)

    # ── Persist to SQLite ──────────────────────────────
    try:
        db.upsert_signal(signal)
    except Exception as exc:
        log.debug("SQLite signal persist failed for %s: %s", coin, exc)

    # Persist time-series snapshot for chart trend rendering.
    try:
        push_snapshot(coin, signal)
    except Exception as exc:
        log.debug("chart_store push_snapshot failed for %s: %s", coin, exc)

    # ── Route to users ─────────────────────────────────
    try:
        await _route_signal_to_users(signal)
    except Exception as exc:
        log.error("Notification routing error: %s", exc)

    _signals_today_count += 1
    return signal


async def prediction_loop():
    """Main prediction engine loop — runs every POLL_INTERVAL seconds."""
    log.info("Prediction engine starting (interval=%ds)", POLL_INTERVAL)

    while True:
        try:
            all_events = _drain_queue()

            if all_events:
                log.info("Processing %d events from queue", len(all_events))
                for evt in all_events:
                    if evt.get("source") == "coingecko" and evt.get("price_change_24h") is not None:
                        for coin in evt.get("coins", []):
                            _volume_data[coin] = evt.get("price_change_24h", 0)
                            # Also persist market data to SQLite
                            try:
                                db.set_market_data(
                                    coin,
                                    evt.get("price_change_24h", 0),
                                    evt.get("volume_24h", 0),
                                )
                            except Exception:
                                pass

            bucketed = _bucket_events_by_coin(all_events)
            tasks = []
            for coin in TRACKED_COINS:
                coin_events = list(bucketed.get(coin, []))
                if not coin_events:
                    boots = _market_bootstrap_events(coin)
                    if boots:
                        coin_events = boots
                        pc = boots[0].get("price_change_24h")
                        if pc is not None:
                            _volume_data[coin] = pc
                tasks.append(_analyze_coin(coin, coin_events))

            if tasks:
                results = await asyncio.gather(*tasks, return_exceptions=True)
                for r in results:
                    if isinstance(r, Exception):
                        log.error("Coin analysis error: %s", r)

        except Exception as exc:
            log.error("Prediction loop error: %s", exc)

        await asyncio.sleep(POLL_INTERVAL)


def get_signals_today_count() -> int:
    return _signals_today_count


def get_uptime() -> float:
    return time.time() - _start_time


async def main():
    """Entry point — run collectors + predictor concurrently."""
    log.info("═══════════════════════════════════════════")
    log.info("  AEGIS-LINK ENGINE STARTING")
    log.info("  Sources: Reddit, CoinGecko, 4chan, StockTwits, CryptoPanic, Telegram")
    log.info("  Storage: SQLite | Pub/Sub: Redis")
    log.info("═══════════════════════════════════════════")

    await asyncio.gather(
        run_collectors(),
        prediction_loop(),
        return_exceptions=True,
    )


if __name__ == "__main__":
    asyncio.run(main())
