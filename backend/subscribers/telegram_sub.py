# backend/subscribers/telegram_sub.py
"""
Aegis-Link — Telegram Subscriber
Subscribes to Redis "aegis:signals" channel.
Sends formatted messages to the global Telegram chat.
Throttled: per-coin cooldown to prevent spam.
"""

import html
import json
import logging
import time
from collections import defaultdict

import redis
import requests

from config import (
    REDIS_HOST, REDIS_PORT, REDIS_SIGNAL_CHANNEL,
    TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID,
)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [telegram_sub] %(levelname)s  %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger("telegram_sub")

_SIGNAL_EMOJI = {
    "PUMP": "🚀",
    "DUMP": "📉",
    "WATCH": "👀",
}

# ── Throttle settings ────────────────────────────────────
# Per-coin cooldown in seconds
_COOLDOWN_PUMP = 300     # 5 minutes between PUMP alerts for same coin
_COOLDOWN_DUMP = 300     # 5 minutes between DUMP alerts for same coin
_COOLDOWN_WATCH = 600    # 10 minutes between WATCH alerts for same coin

# Track last send time per coin+signal_type
_last_sent: dict[str, float] = defaultdict(float)

# Global rate limit: max messages per minute
_GLOBAL_RATE_LIMIT = 15
_global_send_times: list[float] = []


def _should_send(coin: str, signal_type: str) -> bool:
    """Check if we should send this notification (throttle check)."""
    now = time.time()

    # Global rate limit
    _global_send_times[:] = [t for t in _global_send_times if now - t < 60]
    if len(_global_send_times) >= _GLOBAL_RATE_LIMIT:
        log.debug("Global rate limit hit, skipping %s %s", signal_type, coin)
        return False

    # Per-coin cooldown
    key = f"{coin}:{signal_type}"
    last = _last_sent.get(key, 0)

    if signal_type == "PUMP":
        cooldown = _COOLDOWN_PUMP
    elif signal_type == "DUMP":
        cooldown = _COOLDOWN_DUMP
    else:
        cooldown = _COOLDOWN_WATCH

    if now - last < cooldown:
        log.debug(
            "Throttled %s for %s (%.0fs remaining)",
            signal_type, coin, cooldown - (now - last),
        )
        return False

    return True


def _mark_sent(coin: str, signal_type: str) -> None:
    """Record that we sent a notification."""
    now = time.time()
    key = f"{coin}:{signal_type}"
    _last_sent[key] = now
    _global_send_times.append(now)


def _format_message(signal: dict) -> str:
    """Format a signal into a Telegram message (HTML)."""
    signal_type = signal.get("signal", "WATCH")
    emoji = _SIGNAL_EMOJI.get(signal_type, "👀")
    st = html.escape(str(signal_type))
    coin = html.escape(str(signal.get("coin", "?")))
    sent = html.escape(str(signal.get("sentiment", "N/A")))
    src = html.escape(str(signal.get("top_source", "N/A")))
    expl = html.escape(str(signal.get("explanation", "")))
    ts = html.escape(str(signal.get("ts", "")))

    bot_risk = float(signal.get("bot_risk", 0) or 0)
    bot_warning = ""
    if bot_risk > 0.65:
        bot_warning = f"\n⚠️ <b>HIGH BOT RISK</b>: <code>{bot_risk:.0%}</code>"
        flags = signal.get("bot_flags", [])
        if flags:
            bot_warning += "\nFlags: " + html.escape(", ".join(str(f) for f in flags))

    score = signal.get("score", 0)
    influence = signal.get("influencer_weight", 0)

    return (
        f"{emoji} <b>{st} SIGNAL</b> — ${coin}\n"
        f"{'━' * 28}\n"
        f"📊 Score: <code>{round(score)}</code>\n"
        f"💬 Sentiment: <code>{sent}</code> "
        f"({signal.get('confidence', 0)}%)\n"
        f"⚡ Velocity: <code>{int(signal.get('velocity_pct', 0) or 0):+d}%</code>\n"
        f"📈 Volume Spike: <code>{signal.get('volume_spike', 0)}</code>\n"
        f"🤖 Bot Risk: <code>{bot_risk:.0%}</code>\n"
        f"📡 Source: <code>{src}</code>\n"
        f"👤 Influence: <code>{round(float(influence))}%</code>"
        f"{bot_warning}\n\n"
        f"<i>{expl}</i>\n"
        f"<code>{ts}</code>"
    )


def main():
    """Subscribe to Redis and forward signals to Telegram (with throttling)."""
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        log.warning("Telegram bot credentials not set — exiting")
        return

    log.info("Telegram subscriber starting (with throttling)...")
    log.info(
        "Cooldowns: PUMP=%ds, DUMP=%ds, WATCH=%ds, global=%d/min",
        _COOLDOWN_PUMP, _COOLDOWN_DUMP, _COOLDOWN_WATCH, _GLOBAL_RATE_LIMIT,
    )

    r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
    pubsub = r.pubsub()
    pubsub.subscribe(REDIS_SIGNAL_CHANNEL)
    log.info("Subscribed to %s", REDIS_SIGNAL_CHANNEL)

    api_url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"

    for message in pubsub.listen():
        try:
            if message["type"] != "message":
                continue

            signal = json.loads(message["data"])
            coin = signal.get("coin", "?")
            signal_type = signal.get("signal", "WATCH")

            # Throttle check
            if not _should_send(coin, signal_type):
                continue

            text = _format_message(signal)

            payload = {
                "chat_id": TELEGRAM_CHAT_ID,
                "text": text,
                "parse_mode": "HTML",
                "disable_web_page_preview": True,
            }

            resp = requests.post(api_url, json=payload, timeout=10)

            if resp.status_code == 200:
                _mark_sent(coin, signal_type)
                log.info(
                    "Sent %s signal for %s (score=%.1f)",
                    signal_type, coin, signal.get("score", 0),
                )
            elif resp.status_code == 429:
                retry_after = resp.json().get("parameters", {}).get("retry_after", 5)
                log.warning("Rate limited — waiting %ds", retry_after)
                time.sleep(retry_after)
            else:
                log.warning("Telegram API returned %d: %s", resp.status_code, resp.text[:200])

        except json.JSONDecodeError as exc:
            log.error("Invalid JSON from Redis: %s", exc)
        except requests.RequestException as exc:
            log.error("Telegram request error: %s", exc)
        except Exception as exc:
            log.error("Unexpected error: %s", exc)


if __name__ == "__main__":
    main()
